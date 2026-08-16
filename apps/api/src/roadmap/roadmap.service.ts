import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapShAdapter } from './adapters/roadmapsh.adapter';
import { CsvAdapter } from './adapters/csv.adapter';
import { MarkdownAdapter } from './adapters/markdown.adapter';
import { RoadmapSourceAdapter } from './adapters/roadmap-adapter.interface';
import { ImportRoadmapDto } from './dto/import-roadmap.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { MappingStatus, RoadmapStatus, RoadmapPriority } from '@prisma/client';

@Injectable()
export class RoadmapService {
  private readonly adapters: RoadmapSourceAdapter[];

  constructor(
    private readonly prisma: PrismaService,
    roadmapShAdapter: RoadmapShAdapter,
    csvAdapter: CsvAdapter,
    markdownAdapter: MarkdownAdapter,
  ) {
    this.adapters = [roadmapShAdapter, csvAdapter, markdownAdapter];
  }

  async importRoadmap(userId: string, importDto: ImportRoadmapDto) {
    const adapter = this.adapters.find((a) => a.canHandle(importDto.input));
    if (!adapter) {
      throw new BadRequestException(
        'No suitable adapter found for the given roadmap input.',
      );
    }

    const normalized = await adapter.normalize(importDto.input);
    const sourceUrl =
      normalized.sourceUrl ||
      (importDto.input.startsWith('http') ? importDto.input : null);
    const sourceName = importDto.sourceName || normalized.sourceName;

    let targetRoadmap: any = null;

    if (importDto.targetRoadmapId) {
      targetRoadmap = await this.prisma.roadmap.findUnique({
        where: { id: importDto.targetRoadmapId },
      });
      if (!targetRoadmap || targetRoadmap.userId !== userId) {
        throw new ForbiddenException(
          'Specified target roadmap does not exist or belong to user.',
        );
      }
    } else if (!importDto.createNewRoadmap) {
      // Deterministic Identity Matching Hierarchy
      // 1. Exact Source URL Match
      if (sourceUrl) {
        const urlMatches = await this.prisma.roadmap.findMany({
          where: {
            userId,
            deletedAt: null,
            snapshots: {
              some: { sourceUrl },
            },
          },
          include: { snapshots: { orderBy: { importedAt: 'desc' } } },
        });
        if (urlMatches.length === 1) {
          targetRoadmap = urlMatches[0];
        } else if (urlMatches.length > 1) {
          throw new ConflictException({
            code: 'AMBIGUOUS_ROADMAP_MATCH',
            message:
              'Multiple existing roadmaps match this source URL. Select which roadmap to update or create a new one.',
            candidates: urlMatches.map((c) => ({
              id: c.id,
              title: c.title,
              status: c.status,
              priority: c.priority,
              lastImportedAt: c.snapshots[0]?.importedAt,
            })),
          });
        }
      }

      // 2. Unambiguous Name Match
      if (!targetRoadmap) {
        const nameMatches = await this.prisma.roadmap.findMany({
          where: {
            userId,
            deletedAt: null,
            title: { equals: sourceName, mode: 'insensitive' },
          },
          include: { snapshots: { orderBy: { importedAt: 'desc' } } },
        });

        if (nameMatches.length === 1) {
          targetRoadmap = nameMatches[0];
        } else if (nameMatches.length > 1) {
          throw new ConflictException({
            code: 'AMBIGUOUS_ROADMAP_MATCH',
            message:
              'Multiple existing roadmaps match this title. Select which roadmap to update or create a new one.',
            candidates: nameMatches.map((c) => ({
              id: c.id,
              title: c.title,
              status: c.status,
              priority: c.priority,
              lastImportedAt: c.snapshots[0]?.importedAt,
            })),
          });
        }
      }
    }

    // If no existing match, create a new Roadmap parent
    if (!targetRoadmap) {
      targetRoadmap = await this.prisma.roadmap.create({
        data: {
          userId,
          title: sourceName,
          status: RoadmapStatus.ACTIVE,
          priority: RoadmapPriority.PRIMARY,
        },
      });
    } else if (targetRoadmap.status === RoadmapStatus.COMPLETED) {
      // Requirement W: Re-importing into a COMPLETED roadmap reopens it to ACTIVE
      targetRoadmap = await this.prisma.roadmap.update({
        where: { id: targetRoadmap.id },
        data: { status: RoadmapStatus.ACTIVE },
      });
    }

    // Create RoadmapSnapshot under the parent Roadmap
    const snapshot = await this.prisma.roadmapSnapshot.create({
      data: {
        roadmapId: targetRoadmap.id,
        userId,
        sourceType: normalized.sourceType,
        sourceUrl,
        sourceName,
        sourceVersion:
          importDto.sourceVersion || normalized.sourceVersion || '1.0.0',
        metadata: normalized.metadata || {},
      },
    });

    // Create RoadmapNodes & Mappings
    const externalIdToUuidMap = new Map<string, string>();

    for (const node of normalized.nodes) {
      const createdNode = await this.prisma.roadmapNode.create({
        data: {
          snapshotId: snapshot.id,
          externalNodeId: node.externalId,
          title: node.title,
          description: node.description,
          nodeType: node.nodeType,
          sortOrder: node.sortOrder,
          dependencies: node.dependencies,
          resourceUrls: node.resourceUrls,
          metadata: node.metadata,
        },
      });

      externalIdToUuidMap.set(node.externalId, createdNode.id);

      // Check if user previously confirmed/completed an equivalent node in prior snapshot
      const priorMapping = await this.prisma.roadmapMapping.findFirst({
        where: {
          userId,
          roadmapNode: {
            snapshot: { roadmapId: targetRoadmap.id },
            title: { equals: node.title, mode: 'insensitive' },
          },
          userConfirmation: true,
        },
      });

      await this.prisma.roadmapMapping.create({
        data: {
          roadmapNodeId: createdNode.id,
          userId,
          mappingStatus: priorMapping
            ? priorMapping.mappingStatus
            : MappingStatus.NEW,
          confidenceScore: priorMapping ? priorMapping.confidenceScore : 0.0,
          userConfirmation: priorMapping
            ? priorMapping.userConfirmation
            : false,
          journeyId: priorMapping?.journeyId || null,
          taskId: priorMapping?.taskId || null,
          projectId: priorMapping?.projectId || null,
          skillId: priorMapping?.skillId || null,
        },
      });
    }

    // Resolve parentNodeId UUIDs
    for (const node of normalized.nodes) {
      if (node.parentId && externalIdToUuidMap.has(node.parentId)) {
        const nodeUuid = externalIdToUuidMap.get(node.externalId);
        const parentUuid = externalIdToUuidMap.get(node.parentId);
        if (nodeUuid && parentUuid) {
          await this.prisma.roadmapNode.update({
            where: { id: nodeUuid },
            data: { parentNodeId: parentUuid },
          });
        }
      }
    }

    return this.getRoadmapById(userId, targetRoadmap.id);
  }

  async getRoadmaps(userId: string) {
    return this.prisma.roadmap.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          take: 1,
          include: {
            _count: { select: { nodes: true } },
          },
        },
      },
    });
  }

  async getRoadmapById(userId: string, roadmapId: string) {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          include: {
            nodes: {
              orderBy: { sortOrder: 'asc' },
              include: {
                mappings: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!roadmap || roadmap.deletedAt !== null) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found.`);
    }

    if (roadmap.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this roadmap.',
      );
    }

    return roadmap;
  }

  async updateRoadmapStatus(
    userId: string,
    roadmapId: string,
    status: RoadmapStatus,
  ) {
    const roadmap = await this.getRoadmapById(userId, roadmapId);

    return this.prisma.roadmap.update({
      where: { id: roadmap.id },
      data: { status },
    });
  }

  async updateRoadmapPriority(
    userId: string,
    roadmapId: string,
    priority: RoadmapPriority,
  ) {
    const roadmap = await this.getRoadmapById(userId, roadmapId);

    return this.prisma.roadmap.update({
      where: { id: roadmap.id },
      data: { priority },
    });
  }

  async softDeleteRoadmap(userId: string, roadmapId: string) {
    const roadmap = await this.getRoadmapById(userId, roadmapId);

    return this.prisma.roadmap.update({
      where: { id: roadmap.id },
      data: { deletedAt: new Date() },
    });
  }

  async reopenRoadmap(userId: string, roadmapId: string) {
    const roadmap = await this.getRoadmapById(userId, roadmapId);
    return this.updateRoadmapStatus(userId, roadmap.id, RoadmapStatus.ACTIVE);
  }

  /**
   * Requirement M: Self-reported knowledge workflow.
   * Sets node mapping to KNOWN_UNVERIFIED without fabricating verified evidence or mastery.
   */
  async selfReportKnowledge(userId: string, mappingId: string) {
    const mapping = await this.prisma.roadmapMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping || mapping.userId !== userId) {
      throw new ForbiddenException(
        'Roadmap mapping not found or access denied.',
      );
    }

    return this.prisma.roadmapMapping.update({
      where: { id: mappingId },
      data: {
        mappingStatus: MappingStatus.KNOWN_UNVERIFIED,
        userConfirmation: true,
        matchingReason: 'Self-reported by learner (unverified signal).',
      },
    });
  }

  /**
   * Requirements U & V: Completion Candidate & Review Workflow
   */
  async checkCompletionCandidate(userId: string, roadmapId: string) {
    const roadmap = await this.getRoadmapById(userId, roadmapId);
    const latestSnapshot = roadmap.snapshots[0];

    if (!latestSnapshot) {
      return {
        isCandidate: false,
        completedCount: 0,
        totalCount: 0,
        remainingNodes: [],
      };
    }

    const totalNodes = latestSnapshot.nodes.length;
    const completedNodes = latestSnapshot.nodes.filter((n) => {
      const mapping = n.mappings[0];
      return mapping && mapping.mappingStatus === MappingStatus.COMPLETED;
    });

    const remainingNodes = latestSnapshot.nodes.filter((n) => {
      const mapping = n.mappings[0];
      return (
        !mapping ||
        (mapping.mappingStatus !== MappingStatus.COMPLETED &&
          mapping.mappingStatus !== MappingStatus.SKIPPED)
      );
    });

    const isCandidate = totalNodes > 0 && remainingNodes.length === 0;

    return {
      isCandidate,
      completedCount: completedNodes.length,
      totalCount: totalNodes,
      remainingNodes: remainingNodes.map((n) => ({ id: n.id, title: n.title })),
    };
  }

  async reviewCompletion(userId: string, roadmapId: string, confirm: boolean) {
    const candidate = await this.checkCompletionCandidate(userId, roadmapId);

    if (!confirm) {
      throw new BadRequestException(
        'Completion review was not confirmed by user.',
      );
    }

    if (!candidate.isCandidate) {
      throw new BadRequestException(
        `Cannot complete roadmap. ${candidate.remainingNodes.length} required nodes remain unfulfilled.`,
      );
    }

    return this.updateRoadmapStatus(userId, roadmapId, RoadmapStatus.COMPLETED);
  }

  /**
   * Requirements S & T: Analyze Skip Dependency Impact
   */
  async analyzeSkipImpact(userId: string, roadmapId: string, nodeId: string) {
    const roadmap = await this.getRoadmapById(userId, roadmapId);
    const latestSnapshot = roadmap.snapshots[0];

    const targetNode = latestSnapshot?.nodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      throw new NotFoundException(`RoadmapNode with ID ${nodeId} not found.`);
    }

    // Traverse downstream nodes that list targetNode.externalNodeId in dependencies
    const dependentNodes = latestSnapshot.nodes.filter((n) =>
      n.dependencies.includes(targetNode.externalNodeId),
    );

    return {
      targetNode: { id: targetNode.id, title: targetNode.title },
      blockedDependentNodes: dependentNodes.map((n) => ({
        id: n.id,
        title: n.title,
      })),
      impactWarning:
        dependentNodes.length > 0
          ? `Skipping "${targetNode.title}" will block ${dependentNodes.length} downstream dependent topics.`
          : `Skipping "${targetNode.title}" has no downstream dependency impacts.`,
    };
  }

  async updateMapping(
    userId: string,
    mappingId: string,
    dto: UpdateMappingDto,
  ) {
    const mapping = await this.prisma.roadmapMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) {
      throw new NotFoundException(
        `RoadmapMapping with ID ${mappingId} not found.`,
      );
    }

    if (mapping.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this roadmap mapping.',
      );
    }

    // Verify entity ownership
    if (dto.journeyId) {
      const journey = await this.prisma.journey.findUnique({
        where: { id: dto.journeyId },
      });
      if (!journey || journey.userId !== userId)
        throw new ForbiddenException('Target Journey access denied.');
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: dto.taskId },
        include: { journey: true },
      });
      if (!task || task.journey?.userId !== userId)
        throw new ForbiddenException('Target Task access denied.');
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        include: { journey: true },
      });
      if (!project || project.journey?.userId !== userId)
        throw new ForbiddenException('Target Project access denied.');
    }

    if (dto.skillId) {
      const skill = await this.prisma.skill.findUnique({
        where: { id: dto.skillId },
      });
      if (!skill)
        throw new NotFoundException(`Skill with ID ${dto.skillId} not found.`);
    }

    return this.prisma.roadmapMapping.update({
      where: { id: mappingId },
      data: {
        mappingStatus: dto.mappingStatus,
        confidenceScore: dto.confidenceScore,
        matchingReason: dto.matchingReason,
        userConfirmation: dto.userConfirmation,
        journeyId: dto.journeyId,
        taskId: dto.taskId,
        projectId: dto.projectId,
        skillId: dto.skillId,
      },
    });
  }
}
