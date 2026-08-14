import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LearnerState } from '@prisma/client';
import { LearningService } from '../learning.service';

export interface Recommendation {
  conceptId: string;
  title: string;
  reason: string;
  type: 'LEARN' | 'PRACTICE' | 'REVIEW' | 'PROGRESSION';
  isBlocked: boolean; // Must always be false! User autonomy.
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService
  ) {}

  async getRecommendations(userId: string): Promise<Recommendation[]> {
    const concepts = await this.prisma.concept.findMany({
      include: {
        learnerStates: {
          where: { userId }
        }
      }
    });

    const recommendations: Recommendation[] = [];
    const now = new Date();

    for (const concept of concepts) {
      const stateRecord = concept.learnerStates[0];
      const state = stateRecord?.state || LearnerState.UNKNOWN;
      const isStale = this.learningService.isStale(stateRecord?.lastEvaluatedAt || null);

      // Skip/defer logic
      if (stateRecord?.nextReviewAt && stateRecord.nextReviewAt > now) {
         continue; // Deferred, skip recommending
      }

      if (state === LearnerState.UNKNOWN) {
        recommendations.push({
          conceptId: concept.id, title: concept.title, type: 'LEARN', reason: 'Ready to Learn', isBlocked: false
        });
      } else if (state === LearnerState.SELF_REPORTED || state === LearnerState.ASSESSED) {
        recommendations.push({
           conceptId: concept.id, title: concept.title, type: 'PRACTICE', reason: 'Practice / Verification needed', isBlocked: false
        });
      } else if (state === LearnerState.NEEDS_REVIEW || (state === LearnerState.MASTERED && isStale)) {
        recommendations.push({
          conceptId: concept.id, title: concept.title, type: 'REVIEW', reason: 'Review / Recall / Reinforcement', isBlocked: false
        });
      } else if (state === LearnerState.MASTERED && !isStale) {
        recommendations.push({
          conceptId: concept.id, title: concept.title, type: 'PROGRESSION', reason: 'Mastered and Fresh. Ready for next step.', isBlocked: false
        });
      }
    }

    // Advisory sorting: REVIEW first, then PRACTICE, then LEARN, then PROGRESSION
    const order = { 'REVIEW': 0, 'PRACTICE': 1, 'LEARN': 2, 'PROGRESSION': 3 };
    recommendations.sort((a, b) => order[a.type] - order[b.type]);

    return recommendations;
  }

  // Phase 3B-5: Explicit test that arbitrary roadmap navigation is allowed.
  // Prerequisites NEVER produce 403 Forbidden.
  async canAccessConcept(userId: string, conceptId: string): Promise<boolean> {
    // Hard-coded to true to guarantee User Autonomy
    return true; 
  }
}
