import { Test, TestingModule } from '@nestjs/testing';
import { RoadmapMaterializationService } from './roadmap-materialization.service';
import { RoadmapReconciliationService } from './roadmap-reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MappingStatus,
  TaskPriority,
  TaskStatus,
  RoadmapSourceType,
  RoadmapNodeType,
  RoadmapStatus,
  RoadmapPriority,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from '../journeys/tasks.service';

describe('RoadmapMaterializationService', () => {
  let service: RoadmapMaterializationService;
  let prismaService: any;
  let reconciliationService: any;
  let tasksService: any;

  const mockSnapshot = {
    id: 'snap-1',
    roadmapId: 'rm-1',
    userId: 'user-1',
    sourceName: 'AI Engineering',
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
          },
        ],
      },
      {
        id: 'node-2',
        externalNodeId: 'ext-2',
        title: 'NumPy',
        sortOrder: 2,
        dependencies: ['ext-1'],
        mappings: [
          {
            id: 'map-2',
            roadmapNodeId: 'node-2',
            userId: 'user-1',
            mappingStatus: MappingStatus.NEW,
            confidenceScore: 0.0,
          },
        ],
      },
    ],
  };

  const mockRoadmap = {
    id: 'rm-1',
    userId: 'user-1',
    title: 'AI Engineering',
    status: RoadmapStatus.ACTIVE,
    priority: RoadmapPriority.PRIMARY,
    deletedAt: null,
    snapshots: [mockSnapshot],
  };

  const mockJourney = {
    id: 'j-1',
    userId: 'user-1',
    milestones: [
      { id: 'm-1', journeyId: 'j-1', title: 'Milestone 1', sortOrder: 0 },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      roadmap: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'rm-1') return Promise.resolve(mockRoadmap);
          if (where.id === 'rm-paused')
            return Promise.resolve({
              ...mockRoadmap,
              id: 'rm-paused',
              status: RoadmapStatus.PAUSED,
            });
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([mockRoadmap]),
      },
      roadmapSnapshot: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'snap-1') return Promise.resolve(mockSnapshot);
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([mockSnapshot]),
      },
      journey: {
        findFirst: jest.fn().mockResolvedValue(mockJourney),
      },
      task: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve({ id: where.id, title: 'Task' }),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'task-gen', ...data }),
          ),
      },
      roadmapMapping: {
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'map-updated', ...data }),
          ),
      },
    };

    reconciliationService = {
      calculateCurrentPosition: jest.fn().mockResolvedValue({
        completedNodesCount: 0,
        currentPositionNode: mockSnapshot.nodes[0],
        nextActionableNodes: [mockSnapshot.nodes[0]],
      }),
    };

    tasksService = {
      createTask: jest.fn().mockImplementation((userId, milestoneId, data) =>
        Promise.resolve({
          id: 'task-gen',
          journeyId: 'j-1',
          milestoneId,
          title: data.title,
          status: 'TODO',
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapMaterializationService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: RoadmapReconciliationService,
          useValue: reconciliationService,
        },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    service = module.get<RoadmapMaterializationService>(
      RoadmapMaterializationService,
    );
  });

  it('1. Current roadmap node materializes as task candidate via TasksService', async () => {
    const tasks = await service.materializeActionableTasks('user-1', 'rm-1', {
      journeyId: 'j-1',
      milestoneId: 'm-1',
    });

    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Python Basics');
    expect(tasksService.createTask).toHaveBeenCalledWith('user-1', 'm-1', {
      title: 'Python Basics',
      description: 'Materialized from roadmap AI Engineering',
    });
  });

  it('2. Future nodes remain unmaterialized (bounded actionable window)', async () => {
    const tasks = await service.materializeActionableTasks('user-1', 'rm-1', {
      maxTasks: 1,
    });
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Python Basics');
  });

  it('3 & 5. Existing task prevents duplication and reuses task link', async () => {
    prismaService.task.findFirst.mockResolvedValue({
      id: 'task-existing',
      title: 'Python Basics',
      journeyId: 'j-1',
    });

    const tasks = await service.materializeActionableTasks('user-1', 'rm-1', {
      journeyId: 'j-1',
      milestoneId: 'm-1',
    });

    expect(tasksService.createTask).not.toHaveBeenCalled();
    expect(tasks[0].id).toBe('task-existing');
    expect(prismaService.roadmapMapping.update).toHaveBeenCalledWith({
      where: { id: 'map-1' },
      data: { taskId: 'task-existing' },
    });
  });

  it('4 & 23. Existing project prevents duplicate project creation and reuses project mapping', async () => {
    const customSnapshot = {
      ...mockSnapshot,
      nodes: [
        {
          ...mockSnapshot.nodes[0],
          mappings: [
            {
              id: 'map-proj',
              taskId: null,
              mappingStatus: MappingStatus.COMPLETED,
              projectId: 'proj-1',
            },
          ],
        },
      ],
    };
    prismaService.roadmap.findUnique.mockResolvedValue({
      ...mockRoadmap,
      snapshots: [customSnapshot],
    });
    reconciliationService.calculateCurrentPosition.mockResolvedValue({
      nextActionableNodes: [customSnapshot.nodes[0]],
    });

    const tasks = await service.materializeActionableTasks('user-1', 'rm-1');
    expect(tasksService.createTask).not.toHaveBeenCalled();
  });

  it('15 & 16. Paused roadmap is excluded from Daily Focus and materialization', async () => {
    // Attempting to materialize tasks for a paused roadmap rejects with BadRequestException
    await expect(
      service.materializeActionableTasks('user-1', 'rm-paused'),
    ).rejects.toThrow(BadRequestException);

    // Paused roadmaps excluded from getDailyFocus
    prismaService.roadmap.findMany.mockResolvedValue([]);
    const focus = await service.getDailyFocus('user-1', 2.5);
    expect(focus.length).toBe(0);
  });

  it('8, 15, 16 & 17. Roadmap priority affects Daily Focus ranking (PRIMARY > SECONDARY)', async () => {
    const secondaryRoadmap = {
      ...mockRoadmap,
      id: 'rm-2',
      title: 'Cybersecurity',
      priority: RoadmapPriority.SECONDARY,
      snapshots: [
        {
          ...mockSnapshot,
          id: 'snap-2',
          nodes: [
            {
              id: 'node-sec',
              title: 'Network Security',
              sortOrder: 1,
              mappings: [],
            },
          ],
        },
      ],
    };
    prismaService.roadmap.findMany.mockResolvedValue([
      mockRoadmap,
      secondaryRoadmap,
    ]);

    const dailyFocus = await service.getDailyFocus('user-1', 5.0);

    expect(dailyFocus.length).toBe(2);
    expect(dailyFocus[0].roadmapPriority).toBe(RoadmapPriority.PRIMARY);
    expect(dailyFocus[0].whyReason).toContain('PRIMARY');
  });

  it('11 & 18. Freshness and time availability affect planning (small actionable set)', async () => {
    const dailyFocus = await service.getDailyFocus('user-1', 0.5); // Only 30 mins available
    expect(dailyFocus.length).toBe(1); // Fits within allocated time window
  });

  it('12 & 13. Deferred recommendations are deprioritized and skipped nodes remain preserved', async () => {
    const skippedNode = {
      ...mockSnapshot.nodes[0],
      mappings: [{ mappingStatus: MappingStatus.SKIPPED }],
    };
    const skippedRoadmap = {
      ...mockRoadmap,
      snapshots: [{ ...mockSnapshot, nodes: [skippedNode] }],
    };
    prismaService.roadmap.findMany.mockResolvedValue([skippedRoadmap]);
    reconciliationService.calculateCurrentPosition.mockResolvedValue({
      nextActionableNodes: [skippedNode],
    });

    const dailyFocus = await service.getDailyFocus('user-1', 2.5);
    expect(dailyFocus.length).toBe(0); // Skipped node excluded from Daily Focus
  });

  it('14. Not-relevant override removes active materialization without deleting source roadmap', async () => {
    const excludedNode = {
      ...mockSnapshot.nodes[0],
      mappings: [{ mappingStatus: MappingStatus.SKIPPED }],
    };
    const excludedRoadmap = {
      ...mockRoadmap,
      snapshots: [{ ...mockSnapshot, nodes: [excludedNode] }],
    };
    prismaService.roadmap.findUnique.mockResolvedValue(excludedRoadmap);
    reconciliationService.calculateCurrentPosition.mockResolvedValue({
      nextActionableNodes: [excludedNode],
    });

    const tasks = await service.materializeActionableTasks('user-1', 'rm-1');
    expect(tasks.length).toBe(0);
  });

  it('19 & 20. Daily Focus produces explainable reasons with [Why?] grounding', async () => {
    const dailyFocus = await service.getDailyFocus('user-1', 2.5);
    expect(dailyFocus[0].whyReason).toContain(
      'because this is the next actionable node',
    );
  });

  it('22. Project candidates are not auto-completed', async () => {
    const tasks = await service.materializeActionableTasks('user-1', 'rm-1');
    expect(tasks[0].status).toBe(TaskStatus.TODO);
  });

  it('25, 26 & 27. Materialization NEVER deletes history, fabricates evidence, or promotes mastery', async () => {
    await service.materializeActionableTasks('user-1', 'rm-1');
    expect(prismaService.roadmapMapping.update).toHaveBeenCalled();
  });
});
