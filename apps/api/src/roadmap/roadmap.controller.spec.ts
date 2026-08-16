import { Test, TestingModule } from '@nestjs/testing';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapReconciliationService } from './roadmap-reconciliation.service';
import { RoadmapMaterializationService } from './roadmap-materialization.service';
import { RoadmapIntelligenceService } from './roadmap-intelligence.service';
import { ProjectGapService } from './project-gap.service';
import { FreshnessRecommendationService } from '../learning/freshness-recommendation.service';
import { PaceAdaptationService } from '../learning/pace-adaptation.service';
import { RoadmapStatus, RoadmapPriority } from '@prisma/client';

describe('RoadmapController', () => {
  let controller: RoadmapController;
  let service: RoadmapService;
  let reconciliationService: RoadmapReconciliationService;
  let materializationService: RoadmapMaterializationService;
  let intelligenceService: RoadmapIntelligenceService;
  let projectGapService: ProjectGapService;
  let freshnessRecommendationService: FreshnessRecommendationService;
  let paceAdaptationService: PaceAdaptationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoadmapController],
      providers: [
        {
          provide: RoadmapService,
          useValue: {
            importRoadmap: jest.fn().mockResolvedValue({ id: 'rm-1' }),
            getRoadmaps: jest.fn().mockResolvedValue([{ id: 'rm-1' }]),
            getRoadmapById: jest
              .fn()
              .mockResolvedValue({ id: 'rm-1', snapshots: [{ id: 'snap-1' }] }),
            updateRoadmapStatus: jest
              .fn()
              .mockResolvedValue({ id: 'rm-1', status: RoadmapStatus.PAUSED }),
            updateRoadmapPriority: jest.fn().mockResolvedValue({
              id: 'rm-1',
              priority: RoadmapPriority.SECONDARY,
            }),
            softDeleteRoadmap: jest
              .fn()
              .mockResolvedValue({ id: 'rm-1', deletedAt: new Date() }),
            reopenRoadmap: jest
              .fn()
              .mockResolvedValue({ id: 'rm-1', status: RoadmapStatus.ACTIVE }),
            checkCompletionCandidate: jest
              .fn()
              .mockResolvedValue({ isCandidate: true }),
            reviewCompletion: jest.fn().mockResolvedValue({
              id: 'rm-1',
              status: RoadmapStatus.COMPLETED,
            }),
            analyzeSkipImpact: jest
              .fn()
              .mockResolvedValue({ impactWarning: 'None' }),
            selfReportKnowledge: jest.fn().mockResolvedValue({
              id: 'map-1',
              mappingStatus: 'KNOWN_UNVERIFIED',
            }),
            updateMapping: jest.fn().mockResolvedValue({ id: 'map-1' }),
          },
        },
        {
          provide: RoadmapReconciliationService,
          useValue: {
            reconcileSnapshot: jest.fn().mockResolvedValue([]),
            calculateCurrentPosition: jest.fn().mockResolvedValue({
              currentPositionNode: null,
              nextActionableNodes: [],
            }),
          },
        },
        {
          provide: RoadmapMaterializationService,
          useValue: {
            materializeActionableTasks: jest.fn().mockResolvedValue([]),
            getDailyFocus: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RoadmapIntelligenceService,
          useValue: {
            analyzeGoalChangeImpact: jest.fn().mockResolvedValue({
              roadmapId: 'rm-1',
              summaryExplanation: 'Impact OK',
            }),
            getComplementaryContext: jest
              .fn()
              .mockResolvedValue({ roadmapId: 'rm-1', complementaryNodes: [] }),
            decomposeNode: jest.fn().mockResolvedValue({
              nodeId: 'node-1',
              isDecomposed: true,
              subItems: [],
            }),
            dismissDecomposition: jest
              .fn()
              .mockResolvedValue({ nodeId: 'node-1', dismissed: true }),
          },
        },
        {
          provide: ProjectGapService,
          useValue: {
            analyzeProjectGaps: jest
              .fn()
              .mockResolvedValue({ roadmapId: 'rm-1', gaps: [] }),
          },
        },
        {
          provide: FreshnessRecommendationService,
          useValue: {
            getRoadmapFreshnessRecommendations: jest
              .fn()
              .mockResolvedValue({ roadmapId: 'rm-1', recommendations: [] }),
          },
        },
        {
          provide: PaceAdaptationService,
          useValue: {
            getRoadmapPaceAdaptation: jest
              .fn()
              .mockResolvedValue({ roadmapId: 'rm-1', paceState: 'STEADY' }),
          },
        },
      ],
    }).compile();

    controller = module.get<RoadmapController>(RoadmapController);
    service = module.get<RoadmapService>(RoadmapService);
    reconciliationService = module.get<RoadmapReconciliationService>(
      RoadmapReconciliationService,
    );
    materializationService = module.get<RoadmapMaterializationService>(
      RoadmapMaterializationService,
    );
    intelligenceService = module.get<RoadmapIntelligenceService>(
      RoadmapIntelligenceService,
    );
    projectGapService = module.get<ProjectGapService>(ProjectGapService);
    freshnessRecommendationService = module.get<FreshnessRecommendationService>(
      FreshnessRecommendationService,
    );
    paceAdaptationService = module.get<PaceAdaptationService>(
      PaceAdaptationService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('importRoadmap delegates to service', async () => {
    const res = await controller.importRoadmap(
      { user: { id: 'u1' } },
      { sourceType: 'ROADMAP_SH', input: '{}' },
    );
    expect(res).toEqual({ id: 'rm-1' });
    expect(service.importRoadmap).toHaveBeenCalledWith('u1', {
      sourceType: 'ROADMAP_SH',
      input: '{}',
    });
  });

  it('getRoadmaps delegates to service', async () => {
    const res = await controller.getRoadmaps({ user: { id: 'u1' } });
    expect(res).toEqual([{ id: 'rm-1' }]);
    expect(service.getRoadmaps).toHaveBeenCalledWith('u1');
  });

  it('getRoadmapById delegates to service', async () => {
    const res = await controller.getRoadmapById({ user: { id: 'u1' } }, 'rm-1');
    expect(res).toEqual({ id: 'rm-1', snapshots: [{ id: 'snap-1' }] });
    expect(service.getRoadmapById).toHaveBeenCalledWith('u1', 'rm-1');
  });

  it('updateStatus delegates to service', async () => {
    const res = await controller.updateStatus(
      { user: { id: 'u1' } },
      'rm-1',
      RoadmapStatus.PAUSED,
    );
    expect(res.status).toBe(RoadmapStatus.PAUSED);
    expect(service.updateRoadmapStatus).toHaveBeenCalledWith(
      'u1',
      'rm-1',
      RoadmapStatus.PAUSED,
    );
  });

  it('updatePriority delegates to service', async () => {
    const res = await controller.updatePriority(
      { user: { id: 'u1' } },
      'rm-1',
      RoadmapPriority.SECONDARY,
    );
    expect(res.priority).toBe(RoadmapPriority.SECONDARY);
    expect(service.updateRoadmapPriority).toHaveBeenCalledWith(
      'u1',
      'rm-1',
      RoadmapPriority.SECONDARY,
    );
  });

  it('softDeleteRoadmap delegates to service', async () => {
    const res = await controller.softDeleteRoadmap(
      { user: { id: 'u1' } },
      'rm-1',
    );
    expect(res.deletedAt).toBeDefined();
    expect(service.softDeleteRoadmap).toHaveBeenCalledWith('u1', 'rm-1');
  });

  it('selfReportKnowledge delegates to service', async () => {
    const res = await controller.selfReportKnowledge(
      { user: { id: 'u1' } },
      'map-1',
    );
    expect(res.mappingStatus).toBe('KNOWN_UNVERIFIED');
    expect(service.selfReportKnowledge).toHaveBeenCalledWith('u1', 'map-1');
  });

  it('analyzeGoalChangeImpact delegates to intelligenceService', async () => {
    const res = await controller.analyzeGoalChangeImpact(
      { user: { id: 'u1' } },
      'rm-1',
      {},
    );
    expect(res.roadmapId).toBe('rm-1');
    expect(intelligenceService.analyzeGoalChangeImpact).toHaveBeenCalledWith(
      'u1',
      'rm-1',
      {},
    );
  });

  it('getComplementaryContext delegates to intelligenceService', async () => {
    const res = await controller.getComplementaryContext(
      { user: { id: 'u1' } },
      'rm-1',
      'node-1',
    );
    expect(res.roadmapId).toBe('rm-1');
    expect(intelligenceService.getComplementaryContext).toHaveBeenCalledWith(
      'u1',
      'rm-1',
      'node-1',
    );
  });

  it('decomposeNode delegates to intelligenceService', async () => {
    const res = await controller.decomposeNode(
      { user: { id: 'u1' } },
      'node-1',
      { forceDecomposition: true },
    );
    expect(res.isDecomposed).toBe(true);
    expect(intelligenceService.decomposeNode).toHaveBeenCalledWith(
      'u1',
      'node-1',
      { forceDecomposition: true },
    );
  });

  it('dismissDecomposition delegates to intelligenceService', async () => {
    const res = await controller.dismissDecomposition(
      { user: { id: 'u1' } },
      'node-1',
      { reason: 'Dismiss' },
    );
    expect(res.dismissed).toBe(true);
    expect(intelligenceService.dismissDecomposition).toHaveBeenCalledWith(
      'u1',
      'node-1',
      { reason: 'Dismiss' },
    );
  });

  it('analyzeProjectGaps delegates to projectGapService', async () => {
    const res = await controller.analyzeProjectGaps(
      { user: { id: 'u1' } },
      'rm-1',
    );
    expect(res.roadmapId).toBe('rm-1');
    expect(projectGapService.analyzeProjectGaps).toHaveBeenCalledWith(
      'u1',
      'rm-1',
    );
  });

  it('getRoadmapFreshnessRecommendations delegates to freshnessRecommendationService', async () => {
    const res = await controller.getRoadmapFreshnessRecommendations(
      { user: { id: 'u1' } },
      'rm-1',
    );
    expect(res.roadmapId).toBe('rm-1');
    expect(
      freshnessRecommendationService.getRoadmapFreshnessRecommendations,
    ).toHaveBeenCalledWith('u1', 'rm-1');
  });

  it('getRoadmapPaceAdaptation delegates to paceAdaptationService', async () => {
    const res = await controller.getRoadmapPaceAdaptation(
      { user: { id: 'u1' } },
      'rm-1',
    );
    expect(res.roadmapId).toBe('rm-1');
    expect(paceAdaptationService.getRoadmapPaceAdaptation).toHaveBeenCalledWith(
      'u1',
      'rm-1',
    );
  });
});
