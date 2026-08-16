import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapNodeType, ProjectStatus } from '@prisma/client';

export interface ProjectGapResult {
  nodeId: string;
  nodeTitle: string;
  nodeType: RoadmapNodeType;
  gapStatus: 'SATISFIED' | 'EVIDENCE_FOUND' | 'IN_PROGRESS' | 'MISSING';
  projectMatch: boolean;
  evidenceFound: boolean;
  matchedProjectId?: string;
  matchedEvidenceIds: string[];
  requiredTechStack: string[];
  missingCapabilities: string[];
  whyReason: string;
}

export interface ProjectGapAnalysisResponseDto {
  roadmapId: string;
  roadmapTitle: string;
  totalProjectNodes: number;
  satisfiedCount: number;
  evidenceFoundCount: number;
  inProgressCount: number;
  missingCount: number;
  gaps: ProjectGapResult[];
}

@Injectable()
export class ProjectGapService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement H: Project Gap Analysis (Read-Only)
   */
  async analyzeProjectGaps(
    userId: string,
    roadmapId: string,
  ): Promise<ProjectGapAnalysisResponseDto> {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          take: 1,
          include: {
            nodes: {
              include: {
                mappings: {
                  include: {
                    project: true,
                  },
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
        'You do not have permission to perform project gap analysis for this roadmap.',
      );
    }

    const activeSnapshot = roadmap.snapshots[0];
    const allNodes = activeSnapshot?.nodes || [];

    // Filter project nodes (Primary signal: nodeType === PROJECT or explicitly marked in metadata)
    const projectNodes = allNodes.filter(
      (n) =>
        n.nodeType === RoadmapNodeType.PROJECT ||
        (n.metadata as Record<string, any>)?.isProjectDeliverable === true,
    );

    // Fetch all user's projects and evidence items for tech stack matching
    const userProjects = await this.prisma.project.findMany({
      where: { journey: { userId }, deletedAt: null },
      include: { evidence: true },
    });

    const userEvidence = await this.prisma.evidenceItem.findMany({
      where: { userId, deletedAt: null },
    });

    const gaps: ProjectGapResult[] = [];
    let satisfiedCount = 0;
    let evidenceFoundCount = 0;
    let inProgressCount = 0;
    let missingCount = 0;

    for (const node of projectNodes) {
      const nodeMeta = (node.metadata as Record<string, any>) || {};

      // Extract required tech stack strictly from node dependencies/metadata (DO NOT fabricate requirements!)
      const explicitTech: string[] = Array.isArray(nodeMeta.requiredSkills)
        ? nodeMeta.requiredSkills
        : Array.isArray(nodeMeta.techStack)
          ? nodeMeta.techStack
          : [];

      const requiredTechStack = Array.from(
        new Set([...explicitTech, ...(node.dependencies || [])]),
      );

      const mapping = node.mappings[0];
      const linkedProject =
        mapping?.project ||
        userProjects.find((p) => p.id === mapping?.projectId);

      // Find evidence items matching node title or tech stack
      const nodeTitleLower = node.title.toLowerCase();
      const matchingEvidence = userEvidence.filter((e) => {
        const titleMatch =
          e.title.toLowerCase().includes(nodeTitleLower) ||
          nodeTitleLower.includes(e.title.toLowerCase());
        const repoMatch = e.githubRepo
          ? e.githubRepo.toLowerCase().includes(nodeTitleLower)
          : false;
        const eTech =
          (e.metadata as Record<string, any>)?.detectedTechnologies || [];
        const techMatch =
          Array.isArray(eTech) &&
          eTech.some((t) =>
            requiredTechStack
              .map((s) => s.toLowerCase())
              .includes(t.toLowerCase()),
          );

        return titleMatch || repoMatch || techMatch;
      });

      const matchedEvidenceIds = matchingEvidence.map((e) => e.id);
      const hasEvidence = matchedEvidenceIds.length > 0;

      // Find matching project (either direct link or tech-stack overlap)
      let matchedProject = linkedProject;
      if (!matchedProject) {
        matchedProject = userProjects.find(
          (p) =>
            p.title.toLowerCase().includes(nodeTitleLower) ||
            p.techStack.some((t) =>
              requiredTechStack
                .map((s) => s.toLowerCase())
                .includes(t.toLowerCase()),
            ),
        );
      }

      const projectMatch = Boolean(matchedProject);
      const matchedProjectId = matchedProject?.id;

      // Compute missing capabilities
      const coveredTech = new Set<string>();
      if (matchedProject) {
        matchedProject.techStack.forEach((t) =>
          coveredTech.add(t.toLowerCase()),
        );
      }
      matchingEvidence.forEach((e) => {
        const eTech =
          (e.metadata as Record<string, any>)?.detectedTechnologies || [];
        if (Array.isArray(eTech))
          eTech.forEach((t) => coveredTech.add(t.toLowerCase()));
      });

      const missingCapabilities = requiredTechStack.filter(
        (req) => !coveredTech.has(req.toLowerCase()),
      );

      // Classify Gap Status safely according to Revision Correction 2
      let gapStatus: 'SATISFIED' | 'EVIDENCE_FOUND' | 'IN_PROGRESS' | 'MISSING';
      let whyReason = '';

      if (
        matchedProject &&
        matchedProject.status === ProjectStatus.COMPLETED &&
        hasEvidence
      ) {
        gapStatus = 'SATISFIED';
        satisfiedCount++;
        whyReason = `Project requirement "${node.title}" is SATISFIED by completed project "${matchedProject.title}" and verified evidence.`;
      } else if (
        hasEvidence &&
        (!matchedProject || matchedProject.status !== ProjectStatus.COMPLETED)
      ) {
        // Actual EvidenceItem records exist (projectMatch alone does NOT trigger EVIDENCE_FOUND!)
        gapStatus = 'EVIDENCE_FOUND';
        evidenceFoundCount++;
        whyReason = `External evidence found (${matchingEvidence.length} item(s)) matching "${node.title}" tech stack. Formal completed project is pending.`;
      } else if (
        projectMatch ||
        (matchedProject && matchedProject.status === ProjectStatus.IN_PROGRESS)
      ) {
        gapStatus = 'IN_PROGRESS';
        inProgressCount++;
        const pName = matchedProject
          ? matchedProject.title
          : 'matching project';
        whyReason = `Project "${node.title}" has an active matching project (${pName}). External evidence is pending.`;
      } else {
        gapStatus = 'MISSING';
        missingCount++;
        whyReason = `No matching project or evidence found for "${node.title}". Missing capabilities: [${missingCapabilities.join(', ') || 'All requirements'}].`;
      }

      gaps.push({
        nodeId: node.id,
        nodeTitle: node.title,
        nodeType: node.nodeType,
        gapStatus,
        projectMatch,
        evidenceFound: hasEvidence,
        matchedProjectId,
        matchedEvidenceIds,
        requiredTechStack,
        missingCapabilities,
        whyReason,
      });
    }

    return {
      roadmapId: roadmap.id,
      roadmapTitle: roadmap.title,
      totalProjectNodes: projectNodes.length,
      satisfiedCount,
      evidenceFoundCount,
      inProgressCount,
      missingCount,
      gaps,
    };
  }
}
