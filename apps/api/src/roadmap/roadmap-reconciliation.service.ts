import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MappingStatus, TaskStatus, ProjectStatus, LearnerState } from '@prisma/client';

export interface ReconciliationSignal {
  code: string;
  weight: number;
  description: string;
  entityId?: string;
  entityType?: 'task' | 'project' | 'skill' | 'evidence' | 'concept';
}

export interface ReconciliationNodeResult {
  nodeId: string;
  mappingStatus: MappingStatus;
  confidenceScore: number;
  matchingReason: string;
  signals: ReconciliationSignal[];
  journeyId?: string;
  taskId?: string;
  projectId?: string;
  skillId?: string;
}

@Injectable()
export class RoadmapReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs deterministic reconciliation for a given RoadmapSnapshot.
   * Compares snapshot nodes against all existing user learner state.
   */
  async reconcileSnapshot(userId: string, snapshotId: string): Promise<ReconciliationNodeResult[]> {
    // 1. Verify snapshot access
    const snapshot = await this.prisma.roadmapSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        nodes: {
          include: {
            mappings: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`RoadmapSnapshot with ID ${snapshotId} not found.`);
    }

    if (snapshot.userId !== userId) {
      throw new ForbiddenException('You do not have permission to reconcile this roadmap snapshot.');
    }

    // 2. Load user's existing learner state
    const [tasks, projects, skills, evidenceItems, conceptStates] = await Promise.all([
      this.prisma.task.findMany({
        where: { journey: { userId }, deletedAt: null },
        include: { journey: true },
      }),
      this.prisma.project.findMany({
        where: { journey: { userId }, deletedAt: null },
        include: { journey: true },
      }),
      this.prisma.skill.findMany({}), // Skills are global catalog
      this.prisma.evidenceItem.findMany({
        where: { userId, deletedAt: null },
      }),
      this.prisma.learnerConceptState.findMany({
        where: { userId },
        include: { concept: true },
      }),
    ]);

    const results: ReconciliationNodeResult[] = [];

    // 3. Process each node deterministically
    for (const node of snapshot.nodes) {
      const existingMapping = node.mappings[0];

      // Respect user lock if mapping was manually confirmed or skipped
      if (existingMapping && (existingMapping.userConfirmation || existingMapping.mappingStatus === MappingStatus.SKIPPED)) {
        results.push({
          nodeId: node.id,
          mappingStatus: existingMapping.mappingStatus,
          confidenceScore: existingMapping.confidenceScore,
          matchingReason: existingMapping.matchingReason || 'Preserved user confirmed mapping.',
          signals: [{ code: 'USER_CONFIRMED_PRESERVED', weight: 1.0, description: 'User confirmation preserved' }],
          journeyId: existingMapping.journeyId || undefined,
          taskId: existingMapping.taskId || undefined,
          projectId: existingMapping.projectId || undefined,
          skillId: existingMapping.skillId || undefined,
        });
        continue;
      }

      const signals: ReconciliationSignal[] = [];
      let totalScore = 0.0;
      let matchedTaskId: string | undefined;
      let matchedProjectId: string | undefined;
      let matchedSkillId: string | undefined;
      let matchedJourneyId: string | undefined;
      let candidateMatchesCount = 0;

      const normalizedNodeTitle = node.title.toLowerCase().trim();

      // Signal 1: Task match
      const matchingTasks = tasks.filter(t => {
        const taskTitle = t.title.toLowerCase().trim();
        if (taskTitle === normalizedNodeTitle || taskTitle.includes(normalizedNodeTitle) || normalizedNodeTitle.includes(taskTitle)) {
          return true;
        }
        // Token level overlap
        const nodeTokens = normalizedNodeTitle.split(/\s+/).filter(w => w.length > 2);
        const taskTokens = taskTitle.split(/\s+/).filter(w => w.length > 2);
        return nodeTokens.some(nt => taskTokens.includes(nt));
      });

      if (matchingTasks.length > 0) {
        candidateMatchesCount += matchingTasks.length;
        const exactTask = matchingTasks.find(t => t.title.toLowerCase().trim() === normalizedNodeTitle);
        const targetTask = exactTask || matchingTasks[0];
        matchedTaskId = targetTask.id;
        matchedJourneyId = targetTask.journeyId;

        if (targetTask.status === TaskStatus.DONE) {
          const isExact = targetTask.title.toLowerCase().trim() === normalizedNodeTitle;
          const weight = isExact ? 0.80 : 0.35;
          signals.push({
            code: isExact ? 'EXACT_COMPLETED_TASK_MATCH' : 'PARTIAL_COMPLETED_TASK_MATCH',
            weight,
            description: `Matched completed task "${targetTask.title}"`,
            entityId: targetTask.id,
            entityType: 'task',
          });
          totalScore += weight;
        } else if (targetTask.status === TaskStatus.IN_PROGRESS) {
          signals.push({
            code: 'IN_PROGRESS_TASK_MATCH',
            weight: 0.50,
            description: `Matched active task "${targetTask.title}"`,
            entityId: targetTask.id,
            entityType: 'task',
          });
          totalScore += 0.50;
        }
      }

      // Signal 2: Project match
      const matchingProjects = projects.filter(p => {
        const projTitle = p.title.toLowerCase().trim();
        const techMatch = p.techStack.some(ts => ts.toLowerCase().trim() === normalizedNodeTitle);
        return projTitle === normalizedNodeTitle || projTitle.includes(normalizedNodeTitle) || techMatch;
      });

      if (matchingProjects.length > 0) {
        candidateMatchesCount += matchingProjects.length;
        const targetProj = matchingProjects[0];
        matchedProjectId = matchedProjectId || targetProj.id;
        matchedJourneyId = matchedJourneyId || targetProj.journeyId;

        if (targetProj.status === ProjectStatus.COMPLETED) {
          signals.push({
            code: 'COMPLETED_PROJECT_MATCH',
            weight: 0.80,
            description: `Matched completed project "${targetProj.title}"`,
            entityId: targetProj.id,
            entityType: 'project',
          });
          totalScore += 0.80;
        } else if (targetProj.status === ProjectStatus.IN_PROGRESS) {
          signals.push({
            code: 'IN_PROGRESS_PROJECT_MATCH',
            weight: 0.50,
            description: `Matched active project "${targetProj.title}"`,
            entityId: targetProj.id,
            entityType: 'project',
          });
          totalScore += 0.50;
        }
      }

      // Signal 3: Skill match
      const matchingSkill = skills.find(s => s.name.toLowerCase().trim() === normalizedNodeTitle);
      if (matchingSkill) {
        matchedSkillId = matchingSkill.id;
        signals.push({
          code: 'SKILL_CATALOG_MATCH',
          weight: 0.20,
          description: `Matched skill catalog entry "${matchingSkill.name}"`,
          entityId: matchingSkill.id,
          entityType: 'skill',
        });
        totalScore += 0.20;
      }

      // Signal 4: Evidence match
      const matchingEvidence = evidenceItems.filter(e => {
        const evTitle = e.title.toLowerCase().trim();
        return evTitle === normalizedNodeTitle || evTitle.includes(normalizedNodeTitle);
      });

      if (matchingEvidence.length > 0) {
        const verifiedEv = matchingEvidence.find(e => e.verified);
        if (verifiedEv) {
          signals.push({
            code: 'VERIFIED_EVIDENCE_MATCH',
            weight: 0.35,
            description: `Matched verified evidence "${verifiedEv.title}"`,
            entityId: verifiedEv.id,
            entityType: 'evidence',
          });
          totalScore += 0.35;
        } else {
          signals.push({
            code: 'UNVERIFIED_EVIDENCE_MATCH',
            weight: 0.15,
            description: `Matched unverified evidence "${matchingEvidence[0].title}"`,
            entityId: matchingEvidence[0].id,
            entityType: 'evidence',
          });
          totalScore += 0.15;
        }
      }

      // Signal 5: Learner Concept State
      const matchingConceptState = conceptStates.find(cs => cs.concept.title.toLowerCase().trim() === normalizedNodeTitle);
      if (matchingConceptState) {
        if (matchingConceptState.state === LearnerState.MASTERED) {
          signals.push({
            code: 'CONCEPT_MASTERED',
            weight: 0.30,
            description: `Learner state is MASTERED for concept "${matchingConceptState.concept.title}"`,
            entityId: matchingConceptState.conceptId,
            entityType: 'concept',
          });
          totalScore += 0.30;
        } else if (matchingConceptState.state === LearnerState.ASSESSED) {
          signals.push({
            code: 'CONCEPT_ASSESSED',
            weight: 0.20,
            description: `Learner state is ASSESSED for concept "${matchingConceptState.concept.title}"`,
            entityId: matchingConceptState.conceptId,
            entityType: 'concept',
          });
          totalScore += 0.20;
        } else if (matchingConceptState.state === LearnerState.SELF_REPORTED) {
          signals.push({
            code: 'CONCEPT_SELF_REPORTED',
            weight: 0.10,
            description: `Learner state is SELF_REPORTED for concept "${matchingConceptState.concept.title}"`,
            entityId: matchingConceptState.conceptId,
            entityType: 'concept',
          });
          totalScore += 0.10;
        }
      }

      // Cap confidence score at 1.0 max
      const confidenceScore = Math.min(1.0, Math.round(totalScore * 100) / 100);

      // Determine mapping status deterministically based on signals and confidence
      let mappingStatus: MappingStatus = MappingStatus.NEW;

      const hasCompletedTaskOrProj = signals.some(s => s.code === 'EXACT_COMPLETED_TASK_MATCH' || s.code === 'COMPLETED_PROJECT_MATCH');
      const hasVerifiedEvidence = signals.some(s => s.code === 'VERIFIED_EVIDENCE_MATCH');
      const hasMasteredConcept = signals.some(s => s.code === 'CONCEPT_MASTERED');
      const hasInProgressTaskOrProj = signals.some(s => s.code === 'IN_PROGRESS_TASK_MATCH' || s.code === 'IN_PROGRESS_PROJECT_MATCH');

      if (candidateMatchesCount > 1 && confidenceScore < 0.60) {
        mappingStatus = MappingStatus.AMBIGUOUS;
        signals.push({
          code: 'MULTIPLE_CANDIDATES_AMBIGUOUS',
          weight: 0.0,
          description: `Multiple plausible candidate matches found (${candidateMatchesCount})`,
        });
      } else if (confidenceScore >= 0.70 && (hasCompletedTaskOrProj || (hasVerifiedEvidence && hasMasteredConcept))) {
        mappingStatus = MappingStatus.COMPLETED;
      } else if (hasInProgressTaskOrProj) {
        mappingStatus = MappingStatus.IN_PROGRESS;
      } else if (confidenceScore >= 0.35 && (hasVerifiedEvidence || hasMasteredConcept || signals.some(s => s.code === 'PARTIAL_COMPLETED_TASK_MATCH'))) {
        mappingStatus = MappingStatus.KNOWN_UNVERIFIED;
      } else if (confidenceScore >= 0.20) {
        mappingStatus = MappingStatus.PARTIAL_MATCH;
      } else {
        mappingStatus = MappingStatus.NEW;
      }

      const signalCodesStr = signals.map(s => s.code).join(', ');
      const matchingReason = `[Confidence: ${confidenceScore.toFixed(2)}] Signals: ${signalCodesStr || 'NONE'}`;

      results.push({
        nodeId: node.id,
        mappingStatus,
        confidenceScore,
        matchingReason,
        signals,
        journeyId: matchedJourneyId,
        taskId: matchedTaskId,
        projectId: matchedProjectId,
        skillId: matchedSkillId,
      });

      // Update mapping in DB
      if (existingMapping) {
        await this.prisma.roadmapMapping.update({
          where: { id: existingMapping.id },
          data: {
            mappingStatus,
            confidenceScore,
            matchingReason,
            journeyId: matchedJourneyId,
            taskId: matchedTaskId,
            projectId: matchedProjectId,
            skillId: matchedSkillId,
          },
        });
      }
    }

    return results;
  }

  /**
   * Calculates the learner's current position and next actionable steps on a roadmap snapshot.
   */
  async calculateCurrentPosition(userId: string, snapshotId: string) {
    const snapshot = await this.prisma.roadmapSnapshot.findUnique({
      where: { id: snapshotId },
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
    });

    if (!snapshot) {
      throw new NotFoundException(`RoadmapSnapshot with ID ${snapshotId} not found.`);
    }

    if (snapshot.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this roadmap snapshot.');
    }

    const completedNodeExternalIds = new Set<string>();

    for (const node of snapshot.nodes) {
      const mapping = node.mappings[0];
      if (
        mapping &&
        (mapping.mappingStatus === MappingStatus.COMPLETED ||
          mapping.mappingStatus === MappingStatus.SKIPPED ||
          (mapping.userConfirmation && mapping.mappingStatus === MappingStatus.USER_CONFIRMED))
      ) {
        completedNodeExternalIds.add(node.externalNodeId);
      }
    }

    // Find current position: first actionable uncompleted node
    const actionableNodes = [];

    for (const node of snapshot.nodes) {
      if (completedNodeExternalIds.has(node.externalNodeId)) {
        continue;
      }

      // Check dependencies (advisory, non-blocking for user navigation, but used for current position ordering)
      const dependenciesSatisfied = node.dependencies.every(depId => completedNodeExternalIds.has(depId));
      
      actionableNodes.push({
        node,
        mapping: node.mappings[0] || null,
        dependenciesSatisfied,
      });
    }

    const currentPosition = actionableNodes.find(item => item.dependenciesSatisfied) || actionableNodes[0] || null;

    return {
      snapshotId: snapshot.id,
      totalNodes: snapshot.nodes.length,
      completedNodesCount: completedNodeExternalIds.size,
      currentPositionNode: currentPosition ? currentPosition.node : null,
      nextActionableNodes: actionableNodes.slice(0, 3).map(item => item.node),
      isCompletedCandidate: completedNodeExternalIds.size === snapshot.nodes.length && snapshot.nodes.length > 0,
    };
  }
}
