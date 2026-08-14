import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';

export interface SuppressionResultDto {
  conceptId: string;
  conceptTitle: string;
  isSuppressed: boolean;
  priorityReduced: boolean;
  suppressionType: 'SKIP' | 'DEFER' | 'TASK_SKIPPED' | 'ACTIVE';
  deferUntil?: Date;
  reason: string;
  resetTriggers: string[];
}

export interface RecommendationSuppressionResponseDto {
  userId: string;
  evaluatedAt: Date;
  totalConceptsEvaluated: number;
  suppressionList: SuppressionResultDto[];
}

@Injectable()
export class RecommendationSuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement R: Pure Read-Only Observable Recommendation Suppression
   */
  async getSuppressionStatus(userId: string): Promise<RecommendationSuppressionResponseDto> {
    const now = new Date();

    const learnerStates = await this.prisma.learnerConceptState.findMany({
      where: { userId },
      include: { concept: true },
    });

    const evidenceItems = await this.prisma.evidenceItem.findMany({
      where: { userId, verified: true, deletedAt: null },
    });

    const userTasks = await this.prisma.task.findMany({
      where: { journey: { userId }, deletedAt: null },
      include: { skills: { include: { skill: true } } },
    });

    const suppressionList: SuppressionResultDto[] = [];

    // Helper: Collect concepts with recent verified evidence or completed tasks (Reset Triggers)
    const verifiedConceptTitles = new Set<string>();
    for (const ev of evidenceItems) {
      const meta = (ev.metadata as Record<string, any>) || {};
      const techs: string[] = Array.isArray(meta.detectedTechnologies) ? meta.detectedTechnologies : [];
      for (const t of techs) {
        verifiedConceptTitles.add(t.toLowerCase().trim());
      }
    }

    const completedTaskSkillNames = new Set<string>();
    const skippedTaskSkillNames = new Set<string>();
    for (const task of userTasks) {
      for (const ts of task.skills) {
        const sName = ts.skill.name.toLowerCase().trim();
        if (task.status === TaskStatus.DONE) {
          completedTaskSkillNames.add(sName);
        } else if (task.status === TaskStatus.SKIPPED) {
          skippedTaskSkillNames.add(sName);
        }
      }
    }

    for (const stateRec of learnerStates) {
      const cTitle = stateRec.concept.title;
      const cTitleLower = cTitle.toLowerCase().trim();

      // Check Reset Triggers
      const hasNewVerifiedEv = verifiedConceptTitles.has(cTitleLower);
      const hasNewCompletedTask = completedTaskSkillNames.has(cTitleLower);
      const isDeferredExpired = stateRec.nextReviewAt ? stateRec.nextReviewAt <= now : true;

      // If active verified evidence or completed task arrived, suppression is reset dynamically!
      if (hasNewVerifiedEv || hasNewCompletedTask) {
        suppressionList.push({
          conceptId: stateRec.conceptId,
          conceptTitle: cTitle,
          isSuppressed: false,
          priorityReduced: false,
          suppressionType: 'ACTIVE',
          reason: `Suppression reset due to recent verified evidence or task completion for "${cTitle}".`,
          resetTriggers: ['New verified evidence', 'Completed task'],
        });
        continue;
      }

      // 1. Explicit Concept SKIP
      if (stateRec.userIntent === 'SKIP') {
        suppressionList.push({
          conceptId: stateRec.conceptId,
          conceptTitle: cTitle,
          isSuppressed: true,
          priorityReduced: false,
          suppressionType: 'SKIP',
          reason: `Concept "${cTitle}" recommendations suppressed due to explicit user SKIP choice.`,
          resetTriggers: ['New verified evidence', 'Completed task', 'Learner explicit review request'],
        });
        continue;
      }

      // 2. Explicit Concept DEFER
      if (stateRec.userIntent === 'DEFER' && stateRec.nextReviewAt && !isDeferredExpired) {
        suppressionList.push({
          conceptId: stateRec.conceptId,
          conceptTitle: cTitle,
          isSuppressed: true,
          priorityReduced: false,
          suppressionType: 'DEFER',
          deferUntil: stateRec.nextReviewAt,
          reason: `Concept "${cTitle}" recommendations suppressed until deferral date ${stateRec.nextReviewAt.toISOString().split('T')[0]}.`,
          resetTriggers: ['Deferral date expiration', 'New verified evidence', 'Completed task'],
        });
        continue;
      }

      // 3. Observable Task SKIP (Materialized task skipped)
      if (skippedTaskSkillNames.has(cTitleLower)) {
        suppressionList.push({
          conceptId: stateRec.conceptId,
          conceptTitle: cTitle,
          isSuppressed: false,
          priorityReduced: true,
          suppressionType: 'TASK_SKIPPED',
          reason: `Recommendation priority for "${cTitle}" reduced because an associated task was marked SKIPPED.`,
          resetTriggers: ['New completed task', 'New verified evidence'],
        });
        continue;
      }

      // Default: Active, un-suppressed
      suppressionList.push({
        conceptId: stateRec.conceptId,
        conceptTitle: cTitle,
        isSuppressed: false,
        priorityReduced: false,
        suppressionType: 'ACTIVE',
        reason: `Concept "${cTitle}" recommendations are active.`,
        resetTriggers: [],
      });
    }

    return {
      userId,
      evaluatedAt: now,
      totalConceptsEvaluated: suppressionList.length,
      suppressionList,
    };
  }
}
