import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningService } from '../learning.service';
import { LearnerState } from '@prisma/client';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: PrismaService;
  let learningService: LearningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: PrismaService,
          useValue: {
            concept: {
              findMany: jest.fn(),
            }
          },
        },
        {
          provide: LearningService,
          useValue: {
            isStale: jest.fn(),
          }
        }
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    prisma = module.get<PrismaService>(PrismaService);
    learningService = module.get<LearningService>(LearningService);
  });

  // 12. User can navigate to arbitrary roadmap node
  // 13. Prerequisites never block navigation
  it('Prerequisites never block navigation (User Autonomy)', async () => {
    const canAccess = await service.canAccessConcept('user1', 'concept1');
    expect(canAccess).toBe(true);
  });

  // 17. Scheduled/deferred item resurfaces correctly
  it('Deferred concepts are skipped in recommendations if future', async () => {
    jest.spyOn(prisma.concept, 'findMany').mockResolvedValue([
      { id: 'c1', title: 'C1', learnerStates: [{ state: LearnerState.UNKNOWN, nextReviewAt: new Date(2050, 1, 1) }] }
    ] as any);
    jest.spyOn(learningService, 'isStale').mockReturnValue(false);

    const recs = await service.getRecommendations('user1');
    expect(recs.length).toBe(0);
  });

  // 19. STALE recommends review/reinforcement
  it('MASTERED + STALE recommends REVIEW', async () => {
    jest.spyOn(prisma.concept, 'findMany').mockResolvedValue([
      { id: 'c1', title: 'C1', learnerStates: [{ state: LearnerState.MASTERED }] }
    ] as any);
    jest.spyOn(learningService, 'isStale').mockReturnValue(true);

    const recs = await service.getRecommendations('user1');
    expect(recs[0].type).toBe('REVIEW');
    expect(recs[0].reason).toContain('Review');
  });

  it('MASTERED + FRESH recommends PROGRESSION', async () => {
    jest.spyOn(prisma.concept, 'findMany').mockResolvedValue([
      { id: 'c1', title: 'C1', learnerStates: [{ state: LearnerState.MASTERED }] }
    ] as any);
    jest.spyOn(learningService, 'isStale').mockReturnValue(false);

    const recs = await service.getRecommendations('user1');
    expect(recs[0].type).toBe('PROGRESSION');
  });

  it('Sorts REVIEW before PRACTICE before LEARN before PROGRESSION', async () => {
    jest.spyOn(prisma.concept, 'findMany').mockResolvedValue([
      { id: 'c1', title: 'Unknown', learnerStates: [{ state: LearnerState.UNKNOWN }] },
      { id: 'c2', title: 'Assessed', learnerStates: [{ state: LearnerState.ASSESSED }] },
      { id: 'c3', title: 'NeedsReview', learnerStates: [{ state: LearnerState.NEEDS_REVIEW }] },
      { id: 'c4', title: 'Mastered', learnerStates: [{ state: LearnerState.MASTERED }] }
    ] as any);
    jest.spyOn(learningService, 'isStale').mockImplementation((date) => false);

    const recs = await service.getRecommendations('user1');
    expect(recs[0].type).toBe('REVIEW');
    expect(recs[1].type).toBe('PRACTICE');
    expect(recs[2].type).toBe('LEARN');
    expect(recs[3].type).toBe('PROGRESSION');
  });
});
