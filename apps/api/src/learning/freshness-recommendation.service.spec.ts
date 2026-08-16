import { Test, TestingModule } from '@nestjs/testing';
import { FreshnessRecommendationService } from './freshness-recommendation.service';
import { CapabilityFreshnessService } from './capability-freshness.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('FreshnessRecommendationService (Sub-Block 6C - Requirement O)', () => {
  let service: FreshnessRecommendationService;
  let freshnessService: any;
  let prismaService: any;

  const mockNodeMasteredStale = { id: 'n-1', title: 'Python' };
  const mockNodeMasteredFresh = { id: 'n-2', title: 'TypeScript' };
  const mockNodeSelfReported = { id: 'n-3', title: 'Docker' };

  const mockRoadmap = {
    id: 'rm-1',
    userId: 'user-1',
    title: 'Data Science Roadmap',
    deletedAt: null,
    snapshots: [
      {
        id: 'snap-1',
        nodes: [
          mockNodeMasteredStale,
          mockNodeMasteredFresh,
          mockNodeSelfReported,
        ],
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      roadmap: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === 'rm-1') return Promise.resolve(mockRoadmap);
          if (where.id === 'rm-other')
            return Promise.resolve({
              ...mockRoadmap,
              id: 'rm-other',
              userId: 'user-other',
            });
          return Promise.resolve(null);
        }),
      },
      learnerConceptState: { findMany: jest.fn().mockResolvedValue([]) },
    };

    freshnessService = {
      getCapabilityFreshness: jest.fn().mockResolvedValue({
        userId: 'user-1',
        evaluatedAt: new Date(),
        summary: {
          freshCount: 1,
          agingCount: 0,
          staleCount: 1,
          unknownCount: 1,
        },
        freshnessList: [
          {
            capabilityTitle: 'Python',
            learnerState: LearnerState.MASTERED,
            freshnessState: 'STALE',
            lastDemonstratedAt: new Date('2026-04-01'),
          },
          {
            capabilityTitle: 'TypeScript',
            learnerState: LearnerState.MASTERED,
            freshnessState: 'FRESH',
            lastDemonstratedAt: new Date('2026-08-10'),
          },
          {
            capabilityTitle: 'Docker',
            learnerState: LearnerState.SELF_REPORTED,
            freshnessState: 'UNKNOWN_FRESHNESS',
          },
        ],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FreshnessRecommendationService,
        { provide: CapabilityFreshnessService, useValue: freshnessService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<FreshnessRecommendationService>(
      FreshnessRecommendationService,
    );
  });

  describe('Recommendation Rules & Autonomy', () => {
    it('1. Maps MASTERED + STALE -> REVIEW, MASTERED + FRESH -> PROGRESSION, SELF_REPORTED -> PRACTICE', async () => {
      const res = await service.getRoadmapFreshnessRecommendations(
        'user-1',
        'rm-1',
      );

      expect(res.totalRecommendations).toBe(3);

      const pythonRec = res.recommendations.find(
        (r) => r.conceptTitle === 'Python',
      );
      expect(pythonRec?.recommendationType).toBe('REVIEW');
      expect(pythonRec?.isBlocked).toBe(false);

      const tsRec = res.recommendations.find(
        (r) => r.conceptTitle === 'TypeScript',
      );
      expect(tsRec?.recommendationType).toBe('PROGRESSION');
      expect(tsRec?.isBlocked).toBe(false);

      const dockerRec = res.recommendations.find(
        (r) => r.conceptTitle === 'Docker',
      );
      expect(dockerRec?.recommendationType).toBe('PRACTICE');
      expect(dockerRec?.isBlocked).toBe(false);
    });

    it('2. Invariant Check: isBlocked is ALWAYS false for every recommendation', async () => {
      const res = await service.getRoadmapFreshnessRecommendations(
        'user-1',
        'rm-1',
      );

      for (const rec of res.recommendations) {
        expect(rec.isBlocked).toBe(false);
      }
    });

    it('3. Excludes deferred concepts (nextReviewAt > now)', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          conceptId: 'c-py',
          userIntent: 'DEFER',
          nextReviewAt: new Date(Date.now() + 86400000), // Deferred tomorrow
          concept: { title: 'Python' },
        },
      ]);

      const res = await service.getRoadmapFreshnessRecommendations(
        'user-1',
        'rm-1',
      );

      expect(
        res.recommendations.find((r) => r.conceptTitle === 'Python'),
      ).toBeUndefined();
    });

    it('4. Excludes skipped concepts (userIntent === SKIP)', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          conceptId: 'c-py',
          userIntent: 'SKIP',
          concept: { title: 'Python' },
        },
      ]);

      const res = await service.getRoadmapFreshnessRecommendations(
        'user-1',
        'rm-1',
      );

      expect(
        res.recommendations.find((r) => r.conceptTitle === 'Python'),
      ).toBeUndefined();
    });

    it('5. Rejects unauthorized roadmap access with ForbiddenException', async () => {
      await expect(
        service.getRoadmapFreshnessRecommendations('user-1', 'rm-other'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
