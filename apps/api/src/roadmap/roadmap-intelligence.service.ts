import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MappingStatus,
  RoadmapPriority,
  RoadmapStatus,
  LearnerState,
} from '@prisma/client';
import {
  GoalChangeImpactRequestDto,
  DecomposeNodeRequestDto,
  DismissDecompositionRequestDto,
} from './dto/roadmap-intelligence.dto';

@Injectable()
export class RoadmapIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement E: Goal Change Impact Analysis (Read-Only)
   */
  async analyzeGoalChangeImpact(
    userId: string,
    roadmapId: string,
    dto: GoalChangeImpactRequestDto,
  ) {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          take: 1,
          include: {
            nodes: {
              include: {
                mappings: true,
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
        'You do not have permission to analyze this roadmap.',
      );
    }

    const activeSnapshot = roadmap.snapshots[0];
    const nodes = activeSnapshot?.nodes || [];

    const targetPriority = dto.targetPriority || roadmap.priority;
    const targetStatus = dto.targetStatus || roadmap.status;

    // Collect active materialized tasks linked via roadmap mappings
    const mappingTaskIds = nodes
      .map((n) => n.mappings[0]?.taskId)
      .filter((id): id is string => Boolean(id));

    const activeTasks = await this.prisma.task.findMany({
      where: {
        id: { in: mappingTaskIds },
        deletedAt: null,
      },
      include: {
        journey: true,
      },
    });

    // Classify tasks: "NO LONGER PRIORITY" vs "RETAINED USEFUL"
    const isDowngradingPriority =
      (roadmap.priority === RoadmapPriority.PRIMARY &&
        targetPriority !== RoadmapPriority.PRIMARY) ||
      targetStatus === RoadmapStatus.PAUSED;

    const retainedUsefulTasks: {
      taskId: string;
      title: string;
      reason: string;
    }[] = [];
    const deprioritizedTasks: {
      taskId: string;
      title: string;
      newFocusScore: number;
    }[] = [];

    for (const task of activeTasks) {
      if (isDowngradingPriority) {
        deprioritizedTasks.push({
          taskId: task.id,
          title: task.title,
          newFocusScore:
            targetPriority === RoadmapPriority.SECONDARY ? 0.6 : 0.3,
        });
        retainedUsefulTasks.push({
          taskId: task.id,
          title: task.title,
          reason: `Task remains completed/in-progress under ${roadmap.title}. It is deprioritized for Daily Focus, but history and progress are preserved.`,
        });
      } else {
        retainedUsefulTasks.push({
          taskId: task.id,
          title: task.title,
          reason: `Task active under ${roadmap.title} with priority ${targetPriority}.`,
        });
      }
    }

    // Find prerequisite nodes affected
    const prerequisitesAffected = nodes
      .filter((n) => n.dependencies && n.dependencies.length > 0)
      .slice(0, 3)
      .map((n) => ({
        nodeId: n.id,
        nodeTitle: n.title,
        impactDescription: `Prerequisite structure for "${n.title}" will adapt focus order to match ${targetPriority} priority.`,
      }));

    const timelineDeltaDays = isDowngradingPriority ? 14 : 0;

    const summaryExplanation = isDowngradingPriority
      ? `Changing ${roadmap.title} to status ${targetStatus} / priority ${targetPriority} lowers Daily Focus task ranking. Existing tasks are NOT deleted and historical evidence remains 100% intact.`
      : `Target status ${targetStatus} and priority ${targetPriority} maintain active Daily Focus materialization for ${roadmap.title}.`;

    return {
      roadmapId,
      previousPriority: roadmap.priority,
      newPriority: targetPriority,
      previousStatus: roadmap.status,
      newStatus: targetStatus,
      affectedNodesCount: nodes.length,
      activeMaterializedTasksCount: activeTasks.length,
      retainedUsefulTasks,
      deprioritizedTasks,
      prerequisitesAffected,
      estimatedTimelineDeltaDays: timelineDeltaDays,
      summaryExplanation,
    };
  }

  /**
   * Requirement F: Complementary Cross-Roadmap Learning (Read-Only)
   */
  async getComplementaryContext(
    userId: string,
    roadmapId: string,
    nodeId?: string,
  ) {
    const targetRoadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          take: 1,
          include: {
            nodes: {
              include: {
                mappings: true,
              },
            },
          },
        },
      },
    });

    if (!targetRoadmap || targetRoadmap.deletedAt !== null) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found.`);
    }

    if (targetRoadmap.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view complementary context for this roadmap.',
      );
    }

    const activeSnapshot = targetRoadmap.snapshots[0];
    let nodes = activeSnapshot?.nodes || [];

    if (nodeId) {
      nodes = nodes.filter((n) => n.id === nodeId);
      if (nodes.length === 0) {
        throw new NotFoundException(
          `RoadmapNode with ID ${nodeId} not found on this roadmap.`,
        );
      }
    }

    // Fetch all user's concept states & other roadmaps to detect cross-roadmap capabilities
    const conceptStates = await this.prisma.learnerConceptState.findMany({
      where: { userId },
      include: { concept: true },
    });

    const otherRoadmaps = await this.prisma.roadmap.findMany({
      where: {
        userId,
        id: { not: roadmapId },
        deletedAt: null,
      },
      include: {
        snapshots: {
          take: 1,
          orderBy: { importedAt: 'desc' },
          include: {
            nodes: {
              include: { mappings: true },
            },
          },
        },
      },
    });

    const complementaryNodes: {
      nodeId: string;
      nodeTitle: string;
      matchedConceptTitle: string;
      learnerCurrentState: LearnerState;
      suggestedTaskTitle: string;
      suggestedTaskDescription: string;
      whyReason: string;
    }[] = [];

    for (const node of nodes) {
      const nodeTitleLower = node.title.toLowerCase();

      // Find matching concept or skill in other roadmaps
      let matchedState: LearnerState = LearnerState.UNKNOWN;
      let matchedTitle = node.title;

      const directConcept = conceptStates.find(
        (cs) =>
          cs.concept.title.toLowerCase().includes(nodeTitleLower) ||
          nodeTitleLower.includes(cs.concept.title.toLowerCase()),
      );

      if (directConcept) {
        matchedState = directConcept.state;
        matchedTitle = directConcept.concept.title;
      } else {
        // Search other roadmaps for completed/known nodes with same concept
        for (const other of otherRoadmaps) {
          const otherNode = other.snapshots[0]?.nodes.find(
            (n) =>
              n.title.toLowerCase().includes(nodeTitleLower) ||
              nodeTitleLower.includes(n.title.toLowerCase()),
          );
          if (otherNode) {
            const status = otherNode.mappings[0]?.mappingStatus;
            if (
              status === MappingStatus.COMPLETED ||
              status === MappingStatus.USER_CONFIRMED
            ) {
              matchedState = LearnerState.MASTERED;
              matchedTitle = otherNode.title;
              break;
            } else if (
              status === MappingStatus.KNOWN_UNVERIFIED ||
              status === MappingStatus.PARTIAL_MATCH
            ) {
              matchedState = LearnerState.SELF_REPORTED;
              matchedTitle = otherNode.title;
            }
          }
        }
      }

      if (
        matchedState === LearnerState.MASTERED ||
        matchedState === LearnerState.ASSESSED
      ) {
        complementaryNodes.push({
          nodeId: node.id,
          nodeTitle: node.title,
          matchedConceptTitle: matchedTitle,
          learnerCurrentState: matchedState,
          suggestedTaskTitle: `${node.title} for ${targetRoadmap.title}: Contextual Application`,
          suggestedTaskDescription: `Reuses existing ${matchedTitle} capability. Focuses directly on ${targetRoadmap.title} domain implementation rather than repeating generic fundamentals.`,
          whyReason: `Existing ${matchedTitle} capability is strong enough (${matchedState}) to skip generic fundamentals and move to ${targetRoadmap.title} contextual application.`,
        });
      } else if (
        matchedState === LearnerState.SELF_REPORTED ||
        matchedState === LearnerState.NEEDS_REVIEW
      ) {
        complementaryNodes.push({
          nodeId: node.id,
          nodeTitle: node.title,
          matchedConceptTitle: matchedTitle,
          learnerCurrentState: matchedState,
          suggestedTaskTitle: `${node.title} (${targetRoadmap.title} Review & Application)`,
          suggestedTaskDescription: `Provides a brief fundamentals checkpoint for ${node.title} before applying it within ${targetRoadmap.title}.`,
          whyReason: `${matchedTitle} evidence exists but is unverified or needs review (${matchedState}), so a short fundamentals checkpoint is recommended before domain adaptation.`,
        });
      } else {
        complementaryNodes.push({
          nodeId: node.id,
          nodeTitle: node.title,
          matchedConceptTitle: matchedTitle,
          learnerCurrentState: LearnerState.UNKNOWN,
          suggestedTaskTitle: node.title,
          suggestedTaskDescription: `Standard foundational learning path for ${node.title}.`,
          whyReason: `No prior verified capability found for ${node.title}. Standard sequential learning path applies.`,
        });
      }
    }

    return {
      roadmapId,
      complementaryNodes,
    };
  }

  /**
   * Requirement N: Partial Knowledge Decomposition
   */
  async decomposeNode(
    userId: string,
    nodeId: string,
    dto: DecomposeNodeRequestDto,
  ) {
    const node = await this.prisma.roadmapNode.findUnique({
      where: { id: nodeId },
      include: {
        snapshot: {
          include: {
            roadmap: true,
          },
        },
        mappings: true,
      },
    });

    if (!node) {
      throw new NotFoundException(`RoadmapNode with ID ${nodeId} not found.`);
    }

    if (node.snapshot.roadmap.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to decompose this node.',
      );
    }

    let mapping = node.mappings[0];
    if (!mapping) {
      mapping = await this.prisma.roadmapMapping.create({
        data: {
          roadmapNodeId: node.id,
          userId,
          mappingStatus: MappingStatus.NEW,
          confidenceScore: 0.0,
        },
      });
    }

    const currentMetadata = (node.metadata as Record<string, any>) || {};

    // Idempotency Check: Return existing active decomposition unless forceDecomposition is requested
    if (
      currentMetadata.type === 'PARTIAL_DECOMPOSITION' &&
      !currentMetadata.dismissed &&
      !dto.forceDecomposition
    ) {
      return {
        nodeId: node.id,
        roadmapMappingId: mapping.id,
        isDecomposed: true,
        subItems: currentMetadata.subItems || [],
        whyReason:
          currentMetadata.whyReason ||
          'Existing decomposition returned (idempotent).',
      };
    }

    // Learner state evaluation
    const isCompleted = mapping.mappingStatus === MappingStatus.COMPLETED;
    const isAssessed =
      mapping.mappingStatus === MappingStatus.IN_PROGRESS &&
      mapping.confidenceScore >= 0.75;
    const isUnknown =
      mapping.mappingStatus === MappingStatus.NEW &&
      mapping.confidenceScore < 0.2;

    if (isCompleted && !dto.forceDecomposition) {
      return {
        nodeId: node.id,
        roadmapMappingId: mapping.id,
        isDecomposed: false,
        subItems: [],
        whyReason: `Node "${node.title}" is already COMPLETED. Decomposition is unnecessary.`,
      };
    }

    if (isAssessed && !dto.forceDecomposition) {
      return {
        nodeId: node.id,
        roadmapMappingId: mapping.id,
        isDecomposed: false,
        subItems: [],
        whyReason: `Node "${node.title}" has an active, high-confidence target task (score: ${mapping.confidenceScore}). Decomposition is unnecessary.`,
      };
    }

    if (isUnknown && !dto.forceDecomposition) {
      return {
        nodeId: node.id,
        roadmapMappingId: mapping.id,
        isDecomposed: false,
        subItems: [],
        whyReason: `Node "${node.title}" is completely new/unknown. Standard sequential learning applies.`,
      };
    }

    // Perform Partial Knowledge Decomposition (Node DB record remains 100% intact!)
    const subItems = [
      {
        subItemId: `${node.id}-sub-1`,
        title: `${node.title}: Core Concepts & Fundamentals`,
        description: `Targeted review of foundational principles for ${node.title}.`,
        status: 'TODO',
      },
      {
        subItemId: `${node.id}-sub-2`,
        title: `${node.title}: Practical Implementation`,
        description: `Hands-on execution and problem-solving exercises for ${node.title}.`,
        status: 'TODO',
      },
    ];

    const whyReason = dto.forceDecomposition
      ? `Node "${node.title}" explicitly decomposed by user request.`
      : `Node "${node.title}" decomposed into 2 targeted sub-components based on partial knowledge state (${mapping.mappingStatus}, confidence: ${mapping.confidenceScore}).`;

    const updatedMetadata = {
      ...currentMetadata,
      version: 1,
      type: 'PARTIAL_DECOMPOSITION',
      decomposedAt: new Date().toISOString(),
      originalNodeId: node.id,
      originalNodeTitle: node.title,
      subItems,
      dismissed: false,
      whyReason,
    };

    await this.prisma.roadmapNode.update({
      where: { id: node.id },
      data: {
        metadata: updatedMetadata,
      },
    });

    await this.prisma.roadmapMapping.update({
      where: { id: mapping.id },
      data: {
        mappingStatus: MappingStatus.PARTIAL_MATCH,
        matchingReason: whyReason,
      },
    });

    return {
      nodeId: node.id,
      roadmapMappingId: mapping.id,
      isDecomposed: true,
      subItems,
      whyReason,
    };
  }

  /**
   * Requirement N (User Dismissal): Dismiss Partial Knowledge Decomposition
   */
  async dismissDecomposition(
    userId: string,
    nodeId: string,
    dto: DismissDecompositionRequestDto,
  ) {
    const node = await this.prisma.roadmapNode.findUnique({
      where: { id: nodeId },
      include: {
        snapshot: {
          include: {
            roadmap: true,
          },
        },
        mappings: true,
      },
    });

    if (!node) {
      throw new NotFoundException(`RoadmapNode with ID ${nodeId} not found.`);
    }

    if (node.snapshot.roadmap.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to dismiss decomposition for this node.',
      );
    }

    const mapping = node.mappings[0];
    if (!mapping) {
      throw new NotFoundException(
        `RoadmapMapping for node ${nodeId} not found.`,
      );
    }

    const currentMetadata = (node.metadata as Record<string, any>) || {};

    const whyReason = `Decomposition for "${node.title}" dismissed by user. Original unified node representation restored.`;

    const updatedMetadata = {
      ...currentMetadata,
      version: 1,
      type: 'DECOMPOSITION_DISMISSAL',
      dismissed: true,
      dismissedAt: new Date().toISOString(),
      reason: dto.reason || 'User dismissed partial decomposition.',
      previousDecomposition: currentMetadata.subItems
        ? { subItems: currentMetadata.subItems }
        : undefined,
    };

    await this.prisma.roadmapNode.update({
      where: { id: node.id },
      data: {
        metadata: updatedMetadata,
      },
    });

    await this.prisma.roadmapMapping.update({
      where: { id: mapping.id },
      data: {
        matchingReason: whyReason,
      },
    });

    return {
      nodeId: node.id,
      roadmapMappingId: mapping.id,
      dismissed: true,
      whyReason,
    };
  }
}
