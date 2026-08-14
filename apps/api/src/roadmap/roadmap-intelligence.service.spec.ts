import { Test, TestingModule } from '@nestjs/testing';
import { RoadmapIntelligenceService } from './roadmap-intelligence.service';
import { PrismaService } from '../prisma/prisma.service';
import { MappingStatus, RoadmapPriority, RoadmapStatus, LearnerState } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('RoadmapIntelligenceService (Sub-Block 6A)', () => {
  let service: RoadmapIntelligenceService;
  let prismaService: any;

  const mockNode = {
    id: 'node-1',
    externalNodeId: 'ext-1',
    title: 'Python Basics',
    sortOrder: 1,
    dependencies: [],
    metadata: {},
    mappings: [
      {
        id: 'map-1',
        roadmapNodeId: 'node-1',
        userId: 'user-1',
        mappingStatus: MappingStatus.KNOWN_UNVERIFIED,
        confidenceScore: 0.5,
      },
    ],
  };

  const mockNodeUser2 = {
    id: 'node-user2',
    externalNodeId: 'ext-1',
    title: 'Python Basics',
    sortOrder: 1,
    dependencies: [],
    metadata: {},
    mappings: [
      {
        id: 'map-user2',
        roadmapNodeId: 'node-user2',
        userId: 'user-2',
        mappingStatus: MappingStatus.NEW,
        confidenceScore: 0.0,
      },
    ],
  };

  const mockSnapshot = {
    id: 'snap-1',
    roadmapId: 'rm-1',
    userId: 'user-1',
    sourceName: 'AI Engineering',
    nodes: [mockNode],
  };

  const mockSnapshotUser2 = {
    id: 'snap-user2',
    roadmapId: 'rm-user2',
    userId: 'user-2',
    sourceName: 'AI Engineering',
    nodes: [mockNodeUser2],
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

  const mockRoadmapUser2 = {
    id: 'rm-user2',
    userId: 'user-2',
    title: 'AI Engineering',
    status: RoadmapStatus.ACTIVE,
    priority: RoadmapPriority.PRIMARY,
    deletedAt: null,
    snapshots: [mockSnapshotUser2],
  };

  beforeEach(async () => {
    prismaService = {
      roadmap: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'rm-1') return Promise.resolve(mockRoadmap);
          if (where.id === 'rm-user2') return Promise.resolve(mockRoadmapUser2);
          if (where.id === 'rm-other') return Promise.resolve({ ...mockRoadmap, id: 'rm-other', userId: 'user-other' });
          if (where.id === 'rm-deleted') return Promise.resolve({ ...mockRoadmap, id: 'rm-deleted', deletedAt: new Date() });
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      roadmapNode: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'node-1') return Promise.resolve({ ...mockNode, snapshot: { roadmap: mockRoadmap } });
          if (where.id === 'node-user2') return Promise.resolve({ ...mockNodeUser2, snapshot: { roadmap: mockRoadmapUser2 } });
          if (where.id === 'node-other') return Promise.resolve({ ...mockNode, id: 'node-other', snapshot: { roadmap: { ...mockRoadmap, userId: 'user-other' } } });
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      roadmapMapping: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'map-gen', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'task-1', title: 'Python Basics', journey: { id: 'j-1', userId: 'user-1' } },
        ]),
      },
      learnerConceptState: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where.userId === 'user-1') {
            return Promise.resolve([{ concept: { title: 'Python' }, state: LearnerState.MASTERED }]);
          }
          return Promise.resolve([]);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapIntelligenceService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<RoadmapIntelligenceService>(RoadmapIntelligenceService);
  });

  describe('Goal Change Impact Analysis (Requirement E)', () => {
    it('1. Analyzes priority downgrade without mutating database or deleting tasks', async () => {
      const result = await service.analyzeGoalChangeImpact('user-1', 'rm-1', {
        targetPriority: RoadmapPriority.SECONDARY,
      });

      expect(result.roadmapId).toBe('rm-1');
      expect(result.previousPriority).toBe(RoadmapPriority.PRIMARY);
      expect(result.newPriority).toBe(RoadmapPriority.SECONDARY);
      expect(result.activeMaterializedTasksCount).toBe(1);
      expect(result.deprioritizedTasks.length).toBe(1);
      expect(result.retainedUsefulTasks.length).toBe(1);
      expect(result.summaryExplanation).toContain('lowers Daily Focus task ranking');
      expect(prismaService.roadmapMapping.update).not.toHaveBeenCalled();
    });

    it('2. Rejects unauthorized access with ForbiddenException', async () => {
      await expect(service.analyzeGoalChangeImpact('user-1', 'rm-other', {})).rejects.toThrow(ForbiddenException);
    });

    it('3. Rejects soft-deleted roadmap with NotFoundException', async () => {
      await expect(service.analyzeGoalChangeImpact('user-1', 'rm-deleted', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('Complementary Cross-Roadmap Learning (Requirement F)', () => {
    it('1. Generates contextual application task for mastered shared concept', async () => {
      const result = await service.getComplementaryContext('user-1', 'rm-1');

      expect(result.roadmapId).toBe('rm-1');
      expect(result.complementaryNodes.length).toBe(1);
      expect(result.complementaryNodes[0].learnerCurrentState).toBe(LearnerState.MASTERED);
      expect(result.complementaryNodes[0].suggestedTaskTitle).toContain('Contextual Application');
      expect(result.complementaryNodes[0].whyReason).toContain('skip generic fundamentals');
    });

    it('2. Falls back to standard learning path when no matching capability exists', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([]);

      const result = await service.getComplementaryContext('user-1', 'rm-1');

      expect(result.complementaryNodes[0].learnerCurrentState).toBe(LearnerState.UNKNOWN);
      expect(result.complementaryNodes[0].whyReason).toContain('Standard sequential learning path applies');
    });

    it('3. Rejects unauthorized roadmap context access', async () => {
      await expect(service.getComplementaryContext('user-1', 'rm-other')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Partial Knowledge Decomposition (Requirement N)', () => {
    it('1. Decomposes KNOWN_UNVERIFIED node into sub-items while leaving RoadmapNode intact', async () => {
      const result = await service.decomposeNode('user-1', 'node-1', {});

      expect(result.isDecomposed).toBe(true);
      expect(result.subItems.length).toBe(2);
      expect(prismaService.roadmapNode.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'PARTIAL_DECOMPOSITION',
            subItems: expect.any(Array),
          }),
        }),
      });
    });

    it('2. Is idempotent and returns existing active decomposition without recreating', async () => {
      const existingMetadataNode = {
        ...mockNode,
        metadata: {
          type: 'PARTIAL_DECOMPOSITION',
          dismissed: false,
          subItems: [{ subItemId: 'sub-existing', title: 'Existing Sub' }],
          whyReason: 'Existing decomposition',
        },
      };
      prismaService.roadmapNode.findUnique.mockResolvedValue({
        ...existingMetadataNode,
        snapshot: { roadmap: mockRoadmap },
      });

      const result = await service.decomposeNode('user-1', 'node-1', {});

      expect(result.isDecomposed).toBe(true);
      expect(result.subItems[0].subItemId).toBe('sub-existing');
      expect(prismaService.roadmapNode.update).not.toHaveBeenCalled();
    });

    it('3. Rejects unnecessary decomposition for COMPLETED nodes', async () => {
      const completedNode = {
        ...mockNode,
        mappings: [{ ...mockNode.mappings[0], mappingStatus: MappingStatus.COMPLETED }],
      };
      prismaService.roadmapNode.findUnique.mockResolvedValue({
        ...completedNode,
        snapshot: { roadmap: mockRoadmap },
      });

      const result = await service.decomposeNode('user-1', 'node-1', {});

      expect(result.isDecomposed).toBe(false);
      expect(result.whyReason).toContain('already COMPLETED');
    });

    it('4. Rejects unauthorized node decomposition', async () => {
      await expect(service.decomposeNode('user-1', 'node-other', {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('User Decomposition Dismissal', () => {
    it('1. Records explicit dismissal in metadata while preserving historical record', async () => {
      const result = await service.dismissDecomposition('user-1', 'node-1', {
        reason: 'User prefers single unified task',
      });

      expect(result.dismissed).toBe(true);
      expect(result.whyReason).toContain('dismissed by user');
      expect(prismaService.roadmapNode.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'DECOMPOSITION_DISMISSAL',
            dismissed: true,
            reason: 'User prefers single unified task',
          }),
        }),
      });
    });

    it('2. Rejects unauthorized dismissal attempt', async () => {
      await expect(service.dismissDecomposition('user-1', 'node-other', {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Multi-User Safety & Cross-User Isolation Verification', () => {
    it('1. User A decomposing Node A does NOT pollute User B\'s Node B metadata', async () => {
      // User A decomposes node-1
      await service.decomposeNode('user-1', 'node-1', {});

      // User B inspects node-user2 (same topic title)
      const user2Context = await service.getComplementaryContext('user-2', 'rm-user2');

      expect(user2Context.complementaryNodes[0].learnerCurrentState).toBe(LearnerState.UNKNOWN);
      expect(user2Context.complementaryNodes[0].whyReason).toContain('Standard sequential learning path applies');
      expect(mockNodeUser2.metadata).toEqual({}); // User B node metadata remains untouched
    });

    it('2. User A dismissing decomposition on Node A leaves User B unaffected', async () => {
      await service.dismissDecomposition('user-1', 'node-1', { reason: 'User A dismiss' });

      // User B decomposes their own node-user2
      const user2Decompose = await service.decomposeNode('user-2', 'node-user2', { forceDecomposition: true });

      expect(user2Decompose.isDecomposed).toBe(true);
      expect(user2Decompose.nodeId).toBe('node-user2');
      expect(prismaService.roadmapNode.update).toHaveBeenCalledWith({
        where: { id: 'node-user2' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            originalNodeId: 'node-user2',
          }),
        }),
      });
    });

    it('3. User A complementary context does NOT leak to User B', async () => {
      const user1Res = await service.getComplementaryContext('user-1', 'rm-1');
      const user2Res = await service.getComplementaryContext('user-2', 'rm-user2');

      expect(user1Res.complementaryNodes[0].learnerCurrentState).toBe(LearnerState.MASTERED);
      expect(user2Res.complementaryNodes[0].learnerCurrentState).toBe(LearnerState.UNKNOWN);
    });
  });
});
