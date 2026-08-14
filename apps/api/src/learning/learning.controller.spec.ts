import { Test, TestingModule } from '@nestjs/testing';
import { LearningController } from './learning.controller';
import { CapabilitiesController } from './capabilities.controller';
import { LearningService } from './learning.service';
import { RecommendationService } from './recommendation/recommendation.service';
import { CapabilityDiscoveryService } from './capability-discovery.service';
import { CapabilityFreshnessService } from './capability-freshness.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { RecommendationSuppressionService } from './recommendation-suppression.service';

describe('Learning & Capabilities Controllers (Sub-Block 6C & 6D)', () => {
  let learningController: LearningController;
  let capabilitiesController: CapabilitiesController;
  let discoveryService: CapabilityDiscoveryService;
  let freshnessService: CapabilityFreshnessService;
  let conflictResolutionService: ConflictResolutionService;
  let suppressionService: RecommendationSuppressionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LearningController, CapabilitiesController],
      providers: [
        { provide: LearningService, useValue: {} },
        { provide: RecommendationService, useValue: {} },
        {
          provide: CapabilityDiscoveryService,
          useValue: {
            getDiscoveredCapabilities: jest.fn().mockResolvedValue({ userId: 'u1', totalDiscovered: 0, capabilities: [] }),
          },
        },
        {
          provide: CapabilityFreshnessService,
          useValue: {
            getCapabilityFreshness: jest.fn().mockResolvedValue({ userId: 'u1', evaluatedAt: new Date(), summary: {}, freshnessList: [] }),
          },
        },
        {
          provide: ConflictResolutionService,
          useValue: {
            getConflicts: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RecommendationSuppressionService,
          useValue: {
            getSuppressionStatus: jest.fn().mockResolvedValue({ userId: 'u1', totalConceptsEvaluated: 0, suppressionList: [] }),
          },
        },
      ],
    }).compile();

    learningController = module.get<LearningController>(LearningController);
    capabilitiesController = module.get<CapabilitiesController>(CapabilitiesController);
    discoveryService = module.get<CapabilityDiscoveryService>(CapabilityDiscoveryService);
    freshnessService = module.get<CapabilityFreshnessService>(CapabilityFreshnessService);
    conflictResolutionService = module.get<ConflictResolutionService>(ConflictResolutionService);
    suppressionService = module.get<RecommendationSuppressionService>(RecommendationSuppressionService);
  });

  it('learningController should be defined', () => {
    expect(learningController).toBeDefined();
  });

  it('capabilitiesController should be defined', () => {
    expect(capabilitiesController).toBeDefined();
  });

  it('getDiscoveredCapabilities delegates to discoveryService with req.user.id', async () => {
    const res = await capabilitiesController.getDiscoveredCapabilities({ user: { id: 'u1' } });
    expect(res.userId).toBe('u1');
    expect(discoveryService.getDiscoveredCapabilities).toHaveBeenCalledWith('u1');
  });

  it('getCapabilityFreshness delegates to freshnessService with req.user.id', async () => {
    const res = await capabilitiesController.getCapabilityFreshness({ user: { id: 'u1' } });
    expect(res.userId).toBe('u1');
    expect(freshnessService.getCapabilityFreshness).toHaveBeenCalledWith('u1');
  });

  it('getConflicts delegates to conflictResolutionService with req.user.id', async () => {
    const res = await learningController.getConflicts({ user: { id: 'u1' } });
    expect(res).toEqual([]);
    expect(conflictResolutionService.getConflicts).toHaveBeenCalledWith('u1');
  });

  it('getRecommendationAdaptation delegates to suppressionService with req.user.id', async () => {
    const res = await learningController.getRecommendationAdaptation({ user: { id: 'u1' } });
    expect(res.userId).toBe('u1');
    expect(suppressionService.getSuppressionStatus).toHaveBeenCalledWith('u1');
  });
});
