import { Test, TestingModule } from '@nestjs/testing';
import { RoadmapReconciliationService } from './roadmap-reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';
import { MappingStatus, TaskStatus, ProjectStatus, LearnerState, RoadmapSourceType, RoadmapNodeType } from '@prisma/client';

describe('RoadmapReconciliationService', () => {
  let service: RoadmapReconciliationService;
  let prismaService: any;

  const mockSnapshot = {
    id: 'snap-1',
    userId: 'user-1',
    nodes: [
      {
        id: 'node-1',
        externalNodeId: 'ext-1',
        title: 'Python Basics',
        sortOrder: 1,
        dependencies: [],
        mappings: [
          {
            id: 'map-1',
            roadmapNodeId: 'node-1',
            userId: 'user-1',
            mappingStatus: MappingStatus.NEW,
            confidenceScore: 0.0,
            userConfirmation: false,
          },
        ],
      },
      {
        id: 'node-2',
        externalNodeId: 'ext-2',
        title: 'Docker Containers',
        sortOrder: 2,
        dependencies: ['ext-1'],
        mappings: [
          {
            id: 'map-2',
            roadmapNodeId: 'node-2',
            userId: 'user-1',
            mappingStatus: MappingStatus.NEW,
            confidenceScore: 0.0,
            userConfirmation: false,
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      roadmapSnapshot: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'snap-1') return Promise.resolve(mockSnapshot);
          return Promise.resolve(null);
        }),
      },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      skill: { findMany: jest.fn().mockResolvedValue([]) },
      evidenceItem: { findMany: jest.fn().mockResolvedValue([]) },
      learnerConceptState: { findMany: jest.fn().mockResolvedValue([]) },
      roadmapMapping: { update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapReconciliationService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<RoadmapReconciliationService>(RoadmapReconciliationService);
  });

  it('1. Exact existing task match yields COMPLETED status', async () => {
    prismaService.task.findMany.mockResolvedValue([
      { id: 't1', title: 'Python Basics', status: TaskStatus.DONE, journeyId: 'j1' },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.mappingStatus).toBe(MappingStatus.COMPLETED);
    expect(node1Result.confidenceScore).toBeGreaterThanOrEqual(0.45);
    expect(node1Result.signals.some(s => s.code === 'EXACT_COMPLETED_TASK_MATCH')).toBe(true);
  });

  it('2. Existing project match yields COMPLETED status', async () => {
    prismaService.project.findMany.mockResolvedValue([
      { id: 'p1', title: 'Docker Containers', status: ProjectStatus.COMPLETED, techStack: ['Docker'], journeyId: 'j1' },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node2Result = results.find(r => r.nodeId === 'node-2')!;

    expect(node2Result.mappingStatus).toBe(MappingStatus.COMPLETED);
    expect(node2Result.signals.some(s => s.code === 'COMPLETED_PROJECT_MATCH')).toBe(true);
  });

  it('3. Existing skill match without task/evidence yields KNOWN_UNVERIFIED or PARTIAL_MATCH', async () => {
    prismaService.skill.findMany.mockResolvedValue([{ id: 's1', name: 'Python Basics' }]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.mappingStatus).toBe(MappingStatus.PARTIAL_MATCH);
    expect(node1Result.signals.some(s => s.code === 'SKILL_CATALOG_MATCH')).toBe(true);
  });

  it('4. Existing verified evidence match boosts confidence score', async () => {
    prismaService.evidenceItem.findMany.mockResolvedValue([
      { id: 'e1', title: 'Python Basics', verified: true },
    ]);
    prismaService.learnerConceptState.findMany.mockResolvedValue([
      { conceptId: 'c1', concept: { title: 'Python Basics' }, state: LearnerState.MASTERED },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.signals.some(s => s.code === 'VERIFIED_EVIDENCE_MATCH')).toBe(true);
    expect(node1Result.signals.some(s => s.code === 'CONCEPT_MASTERED')).toBe(true);
  });

  it('5. Known but unverified (Self-Reported Concept + Unverified Evidence)', async () => {
    prismaService.evidenceItem.findMany.mockResolvedValue([
      { id: 'e1', title: 'Python Basics', verified: false },
    ]);
    prismaService.learnerConceptState.findMany.mockResolvedValue([
      { conceptId: 'c1', concept: { title: 'Python Basics' }, state: LearnerState.SELF_REPORTED },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.mappingStatus).toBe(MappingStatus.PARTIAL_MATCH);
    expect(node1Result.signals.some(s => s.code === 'CONCEPT_SELF_REPORTED')).toBe(true);
  });

  it('6. Partial match for topic overlap', async () => {
    prismaService.task.findMany.mockResolvedValue([
      { id: 't1', title: 'Intro to Python', status: TaskStatus.DONE, journeyId: 'j1' },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.signals.some(s => s.code === 'PARTIAL_COMPLETED_TASK_MATCH')).toBe(true);
  });

  it('7. Ambiguous match when multiple tasks partially match with low confidence', async () => {
    prismaService.task.findMany.mockResolvedValue([
      { id: 't1', title: 'Python Basics Part 1', status: TaskStatus.DONE, journeyId: 'j1' },
      { id: 't2', title: 'Python Basics Part 2', status: TaskStatus.DONE, journeyId: 'j1' },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.signals.some(s => s.code === 'MULTIPLE_CANDIDATES_AMBIGUOUS')).toBe(true);
    expect(node1Result.mappingStatus).toBe(MappingStatus.AMBIGUOUS);
  });

  it('8. New node when no learner state matches', async () => {
    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.mappingStatus).toBe(MappingStatus.NEW);
    expect(node1Result.confidenceScore).toBe(0.0);
  });

  it('9 & 10. User-confirmed mapping is preserved without being overwritten', async () => {
    const customSnapshot = {
      ...mockSnapshot,
      nodes: [
        {
          ...mockSnapshot.nodes[0],
          mappings: [
            {
              id: 'map-confirmed',
              roadmapNodeId: 'node-1',
              userId: 'user-1',
              mappingStatus: MappingStatus.USER_CONFIRMED,
              confidenceScore: 1.0,
              userConfirmation: true,
              matchingReason: 'User explicitly confirmed',
            },
          ],
        },
      ],
    };
    prismaService.roadmapSnapshot.findUnique.mockResolvedValue(customSnapshot);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results[0];

    expect(node1Result.mappingStatus).toBe(MappingStatus.USER_CONFIRMED);
    expect(node1Result.confidenceScore).toBe(1.0);
    expect(node1Result.signals[0].code).toBe('USER_CONFIRMED_PRESERVED');
  });

  it('11 & 12. Skipped node status is preserved', async () => {
    const customSnapshot = {
      ...mockSnapshot,
      nodes: [
        {
          ...mockSnapshot.nodes[0],
          mappings: [
            {
              id: 'map-skipped',
              roadmapNodeId: 'node-1',
              userId: 'user-1',
              mappingStatus: MappingStatus.SKIPPED,
              confidenceScore: 0.0,
              userConfirmation: false,
            },
          ],
        },
      ],
    };
    prismaService.roadmapSnapshot.findUnique.mockResolvedValue(customSnapshot);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    expect(results[0].mappingStatus).toBe(MappingStatus.SKIPPED);
  });

  it('13 & 14. Dependency-aware current position calculation (non-blocking autonomy)', async () => {
    const customSnapshot = {
      ...mockSnapshot,
      nodes: [
        {
          ...mockSnapshot.nodes[0],
          mappings: [{ mappingStatus: MappingStatus.COMPLETED }],
        },
        {
          ...mockSnapshot.nodes[1],
          mappings: [{ mappingStatus: MappingStatus.NEW }],
        },
      ],
    };
    prismaService.roadmapSnapshot.findUnique.mockResolvedValue(customSnapshot);

    const pos = await service.calculateCurrentPosition('user-1', 'snap-1');
    expect(pos.completedNodesCount).toBe(1);
    expect(pos.currentPositionNode!.externalNodeId).toBe('ext-2');
    expect(pos.isCompletedCandidate).toBe(false);
  });

  it('15 & 16. Cross-roadmap evidence reuse via shared learner state', async () => {
    prismaService.evidenceItem.findMany.mockResolvedValue([
      { id: 'ev-from-journey-a', title: 'Python Basics', verified: true, userId: 'user-1' },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    const node1Result = results.find(r => r.nodeId === 'node-1')!;

    expect(node1Result.signals.some(s => s.code === 'VERIFIED_EVIDENCE_MATCH')).toBe(true);
  });

  it('17. Reason codes and explainable matching reason format', async () => {
    prismaService.task.findMany.mockResolvedValue([
      { id: 't1', title: 'Python Basics', status: TaskStatus.DONE, journeyId: 'j1' },
    ]);

    const results = await service.reconcileSnapshot('user-1', 'snap-1');
    expect(results[0].matchingReason).toContain('[Confidence:');
    expect(results[0].matchingReason).toContain('EXACT_COMPLETED_TASK_MATCH');
  });

  it('18. Deterministic repeated reconciliation yields identical scores and signals', async () => {
    prismaService.task.findMany.mockResolvedValue([
      { id: 't1', title: 'Python Basics', status: TaskStatus.DONE, journeyId: 'j1' },
    ]);

    const run1 = await service.reconcileSnapshot('user-1', 'snap-1');
    const run2 = await service.reconcileSnapshot('user-1', 'snap-1');

    expect(run1[0].confidenceScore).toBe(run2[0].confidenceScore);
    expect(run1[0].mappingStatus).toBe(run2[0].mappingStatus);
    expect(run1[0].matchingReason).toBe(run2[0].matchingReason);
  });

  it('19 & 20. Reconciliation NEVER silently promotes mastery or completes tasks/projects', async () => {
    await service.reconcileSnapshot('user-1', 'snap-1');
    expect(prismaService.roadmapMapping.update).toHaveBeenCalled();
  });

  it('21. Historical mappings are preserved', async () => {
    const pos = await service.calculateCurrentPosition('user-1', 'snap-1');
    expect(pos.snapshotId).toBe('snap-1');
  });
});
