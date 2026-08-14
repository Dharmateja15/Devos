import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, IndependenceSignal, TaskStatus, EvidenceType } from '@prisma/client';

export interface MasteryCheckOptions {
  mode: 'TRADITIONAL_QUIZ' | 'EXPLANATION' | 'DEBUGGING' | 'SCENARIO' | 'TRANSFER';
  passed: boolean;
  stoppedEarly?: boolean;
}

export type UserIntent = 'SKIP' | 'DEFER' | 'SCHEDULE';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async getLearnerState(userId: string, conceptId: string) {
    const record = await this.prisma.learnerConceptState.findUnique({
      where: {
        userId_conceptId: { userId, conceptId }
      }
    });
    return record || { state: LearnerState.UNKNOWN };
  }

  isStale(lastEvaluatedAt: Date | null): boolean {
    if (!lastEvaluatedAt) return false;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastEvaluatedAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays > 30; // 30 days threshold
  }

  async selfReportConcept(userId: string, conceptId: string) {
    const current = await this.getLearnerState(userId, conceptId);
    
    // Self report NEVER produces MASTERED.
    if ('state' in current && (current.state === LearnerState.MASTERED || current.state === LearnerState.ASSESSED)) {
       return current;
    }

    return this.prisma.learnerConceptState.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      update: {
        state: LearnerState.SELF_REPORTED,
        lastEvaluatedAt: new Date(),
      },
      create: {
        userId,
        conceptId,
        state: LearnerState.SELF_REPORTED,
        lastEvaluatedAt: new Date(),
      }
    });
  }

  // PHASE 3B-2 Final Fix: Multi-factor contextual model.
  async evaluateTaskEvidence(userId: string, conceptId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { evidence: true }
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.status !== TaskStatus.DONE) {
       throw new BadRequestException('Task must be completed to evaluate mastery');
    }

    const current = await this.getLearnerState(userId, conceptId);
    let currentStateStr = 'state' in current ? current.state : LearnerState.UNKNOWN;
    
    // AI_ASSISTED is legitimate work, not numerically punished.
    let newState: LearnerState = currentStateStr as LearnerState;
    if (newState === LearnerState.UNKNOWN || newState === LearnerState.SELF_REPORTED) {
      newState = LearnerState.ASSESSED;
    }

    // Contextual evaluation for MASTERED
    const isIndependent = task.independenceSignal === IndependenceSignal.INDEPENDENT;
    const hasVerifiedEvidence = task.evidence.some(e => e.verified);
    const hasHighQualityEvidence = task.evidence.some(e => e.evidenceType === EvidenceType.GITHUB_PR || e.evidenceType === EvidenceType.GITHUB_COMMIT);
    
    // Example of contextual rule: No single combination automatically guarantees mastery.
    // If they were already ASSESSED, AND they have verified evidence, AND it's high quality OR independent, they might reach MASTERED.
    // AI_ASSISTED does not automatically create independent mastery, but it contributes to ASSESSED state.
    if (currentStateStr === LearnerState.ASSESSED && hasVerifiedEvidence && (isIndependent || hasHighQualityEvidence)) {
      newState = LearnerState.MASTERED;
    }

    // In a full implementation, an evaluator considers freshness and consistency.
    // For MVP, we apply a deterministic contextual check.

    return this.prisma.learnerConceptState.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      update: {
        state: newState,
        lastEvaluatedAt: new Date(),
      },
      create: {
        userId,
        conceptId,
        state: newState,
        lastEvaluatedAt: new Date(),
      }
    });
  }

  async submitMasteryCheck(userId: string, conceptId: string, options: MasteryCheckOptions) {
     const { mode, passed, stoppedEarly } = options;

     const masteryTasks = await this.prisma.task.count({
       where: {
         tags: { hasSome: ['MASTERY_CHECK', `CONCEPT_${conceptId}`] }, 
       }
     });

     if (masteryTasks >= 3) {
       throw new BadRequestException('Maximum mastery attempts (3) exceeded.');
     }

     if (masteryTasks === 0 && mode !== 'TRADITIONAL_QUIZ') {
       throw new BadRequestException('TRADITIONAL_QUIZ is mandatory as the first mastery-check mode.');
     }

     const current = await this.getLearnerState(userId, conceptId);
     let newState = 'state' in current ? current.state : LearnerState.UNKNOWN;

     if (stoppedEarly) {
       return current;
     }

     if (passed) {
       newState = LearnerState.MASTERED;
     } else {
       if (newState === LearnerState.MASTERED) {
         newState = LearnerState.NEEDS_REVIEW;
       } else if (newState === LearnerState.UNKNOWN || newState === LearnerState.SELF_REPORTED) {
         newState = LearnerState.ASSESSED;
       }
     }

     return this.prisma.learnerConceptState.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      update: {
        state: newState,
        lastEvaluatedAt: new Date(),
      },
      create: {
        userId,
        conceptId,
        state: newState,
        lastEvaluatedAt: new Date(),
      }
    });
  }

  // PHASE 3B-3 Final Fix: Separate Skip/Defer/Schedule intent
  async setUserIntent(userId: string, conceptId: string, intent: UserIntent, date?: Date) {
    const current = await this.getLearnerState(userId, conceptId);
    let state = 'state' in current ? current.state : LearnerState.UNKNOWN;
    
    // Intent does NOT alter the 5 LearnerState values.
    // Intent preserves history.
    return this.prisma.learnerConceptState.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      update: {
        userIntent: intent,
        nextReviewAt: date || null,
      },
      create: {
        userId,
        conceptId,
        state,
        userIntent: intent,
        nextReviewAt: date || null,
      }
    });
  }
}
