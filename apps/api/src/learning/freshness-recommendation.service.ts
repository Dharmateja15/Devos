import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CapabilityFreshnessService,
  FreshnessState,
} from './capability-freshness.service';
import { LearnerState } from '@prisma/client';

export type RecommendationType =
  'REVIEW' | 'PRACTICE' | 'LEARN' | 'PROGRESSION';

export interface FreshnessRecommendationDto {
  conceptId: string;
  conceptTitle: string;
  recommendationType: RecommendationType;
  learnerState: LearnerState;
  freshnessState: FreshnessState;
  lastDemonstratedAt?: Date;
  reason: string;
  whyReason: string;
  isBlocked: boolean; // MUST ALWAYS BE FALSE (User Autonomy)
}

export interface RoadmapFreshnessRecommendationsResponseDto {
  roadmapId: string;
  roadmapTitle: string;
  totalRecommendations: number;
  recommendations: FreshnessRecommendationDto[];
}

@Injectable()
export class FreshnessRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly freshnessService: CapabilityFreshnessService,
  ) {}

  /**
   * Requirement O: Advisory Freshness & Review Recommendations for a Roadmap
   */
  async getRoadmapFreshnessRecommendations(
    userId: string,
    roadmapId: string,
  ): Promise<RoadmapFreshnessRecommendationsResponseDto> {
    // 1. Verify Roadmap Ownership
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        snapshots: {
          take: 1,
          orderBy: { importedAt: 'desc' },
          include: { nodes: true },
        },
      },
    });

    if (!roadmap || roadmap.deletedAt !== null) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found.`);
    }

    if (roadmap.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view recommendations for this roadmap.',
      );
    }

    const activeSnapshot = roadmap.snapshots[0];
    const roadmapNodes = activeSnapshot?.nodes || [];

    // Fetch user freshness evaluation
    const freshnessRes =
      await this.freshnessService.getCapabilityFreshness(userId);
    const freshnessMap = new Map(
      freshnessRes.freshnessList.map((f) => [
        f.capabilityTitle.toLowerCase(),
        f,
      ]),
    );

    // Fetch learner concept states to check userIntent and nextReviewAt
    const learnerStates = await this.prisma.learnerConceptState.findMany({
      where: { userId },
      include: { concept: true },
    });
    const stateMap = new Map(
      learnerStates.map((s) => [s.concept.title.toLowerCase(), s]),
    );

    const now = new Date();
    const recommendations: FreshnessRecommendationDto[] = [];

    for (const node of roadmapNodes) {
      const nodeTitleLower = node.title.toLowerCase().trim();
      const stateRecord = stateMap.get(nodeTitleLower);

      // Exclude deferred concepts (nextReviewAt > now)
      if (stateRecord?.nextReviewAt && stateRecord.nextReviewAt > now) {
        continue;
      }

      // Exclude skipped concepts (userIntent === 'SKIP')
      if (stateRecord?.userIntent === 'SKIP') {
        continue;
      }

      const freshnessItem = freshnessMap.get(nodeTitleLower);
      const learnerState =
        stateRecord?.state ||
        freshnessItem?.learnerState ||
        LearnerState.UNKNOWN;
      const freshnessState =
        freshnessItem?.freshnessState || 'UNKNOWN_FRESHNESS';
      const lastDemonstratedAt = freshnessItem?.lastDemonstratedAt;

      let recType: RecommendationType = 'LEARN';
      let reason = '';
      let whyReason = '';

      if (learnerState === LearnerState.MASTERED) {
        if (freshnessState === 'STALE') {
          recType = 'REVIEW';
          reason = 'Mastered concept has not been demonstrated recently.';
          whyReason = `Concept "${node.title}" was mastered previously, but no activity observed in >60 days. Advisory refresher recommended.`;
        } else if (freshnessState === 'AGING') {
          recType = 'PROGRESSION';
          reason =
            'Mastered concept is aging; normal progression with optional reinforcement.';
          whyReason = `Concept "${node.title}" is mastered with aging recency (31-60 days). Safe to progress or briefly review.`;
        } else {
          recType = 'PROGRESSION';
          reason = 'Mastered concept is fresh. Ready for advanced concepts.';
          whyReason = `Concept "${node.title}" is freshly demonstrated and mastered. Ready for progression.`;
        }
      } else if (learnerState === LearnerState.NEEDS_REVIEW) {
        recType = 'REVIEW';
        reason = 'Concept is marked as needing review.';
        whyReason = `Concept "${node.title}" requires review based on prior evaluation.`;
      } else if (
        learnerState === LearnerState.ASSESSED ||
        learnerState === LearnerState.SELF_REPORTED
      ) {
        recType = 'PRACTICE';
        reason = 'Concept requires practical application or verification.';
        whyReason = `Concept "${node.title}" is in ${learnerState} state. Practical application task recommended.`;
      } else {
        recType = 'LEARN';
        reason = 'Ready to learn new concept.';
        whyReason = `Concept "${node.title}" is unknown. Ready for initial learning.`;
      }

      recommendations.push({
        conceptId: stateRecord?.conceptId || `node-${node.id}`,
        conceptTitle: node.title,
        recommendationType: recType,
        learnerState,
        freshnessState,
        lastDemonstratedAt,
        reason,
        whyReason,
        isBlocked: false, // Strict User Autonomy guarantee!
      });
    }

    // Advisory sorting: REVIEW first (0), PRACTICE (1), LEARN (2), PROGRESSION (3)
    const priorityOrder: Record<RecommendationType, number> = {
      REVIEW: 0,
      PRACTICE: 1,
      LEARN: 2,
      PROGRESSION: 3,
    };

    recommendations.sort(
      (a, b) =>
        priorityOrder[a.recommendationType] -
        priorityOrder[b.recommendationType],
    );

    return {
      roadmapId: roadmap.id,
      roadmapTitle: roadmap.title,
      totalRecommendations: recommendations.length,
      recommendations,
    };
  }
}
