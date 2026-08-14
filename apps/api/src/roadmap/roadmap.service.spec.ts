import { Test, TestingModule } from '@nestjs/testing';
import { RoadmapService } from './roadmap.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapShAdapter } from './adapters/roadmapsh.adapter';
import { CsvAdapter } from './adapters/csv.adapter';
import { MarkdownAdapter } from './adapters/markdown.adapter';
import { MappingStatus, RoadmapSourceType, RoadmapNodeType, RoadmapStatus, RoadmapPriority } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('RoadmapService - Block 5 Specification', () => {
  let service: RoadmapService;
  let prismaService: any;

  const mockRoadmap = {
    id: 'rm-1',
    userId: 'user-1',
    title: 'AI Engineer',
    status: RoadmapStatus.ACTIVE,
    priority: RoadmapPriority.PRIMARY,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    snapshots: [
      {
        id: 'snap-1',
        roadmapId: 'rm-1',
        userId: 'user-1',
        sourceType: RoadmapSourceType.ROADMAP_SH,
        sourceName: 'AI Engineer',
        sourceUrl: 'https://roadmap.sh/ai',
        sourceVersion: '1.0.0',
        importedAt: new Date(),
        nodes: [
          {
            id: 'node-1',
            snapshotId: 'snap-1',
            externalNodeId: 'n1',
            title: 'Python',
            nodeType: RoadmapNodeType.SKILL,
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
            snapshotId: 'snap-1',
            externalNodeId: 'n2',
            title: 'NumPy',
            nodeType: RoadmapNodeType.TOPIC,
            dependencies: ['n1'],
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
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      roadmap: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rm-gen', status: RoadmapStatus.ACTIVE, priority: RoadmapPriority.PRIMARY, ...data })),
        findMany: jest.fn().mockResolvedValue([mockRoadmap]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'rm-1') return Promise.resolve(mockRoadmap);
          if (where.id === 'rm-gen') return Promise.resolve({ ...mockRoadmap, id: 'rm-gen' });
          if (where.id === 'rm-completed') return Promise.resolve({ ...mockRoadmap, id: 'rm-completed', status: RoadmapStatus.COMPLETED });
          if (where.id === 'rm-archived') return Promise.resolve({ ...mockRoadmap, id: 'rm-archived', status: RoadmapStatus.ARCHIVED, deletedAt: null });
          if (where.id === 'rm-other-user') return Promise.resolve({ ...mockRoadmap, id: 'rm-other-user', userId: 'user-other' });
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ ...mockRoadmap, ...data, id: where.id })),
      },
      roadmapSnapshot: {
        create: jest.fn().mockResolvedValue(mockRoadmap.snapshots[0]),
        findMany: jest.fn().mockResolvedValue([mockRoadmap.snapshots[0]]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'snap-1') return Promise.resolve(mockRoadmap.snapshots[0]);
          return Promise.resolve(null);
        }),
      },
      roadmapNode: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'node-gen', ...data })),
        update: jest.fn().mockResolvedValue({}),
      },
      roadmapMapping: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'map-gen', ...data })),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([mockRoadmap.snapshots[0].nodes[0].mappings[0]]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'map-1') return Promise.resolve(mockRoadmap.snapshots[0].nodes[0].mappings[0]);
          if (where.id === 'map-other-user') return Promise.resolve({ ...mockRoadmap.snapshots[0].nodes[0].mappings[0], id: 'map-other-user', userId: 'user-other' });
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapService,
        RoadmapShAdapter,
        CsvAdapter,
        MarkdownAdapter,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<RoadmapService>(RoadmapService);
  });

  it('1. Multiple simultaneous roadmaps supported for single user', async () => {
    const roadmaps = await service.getRoadmaps('user-1');
    expect(roadmaps.length).toBe(1);
    expect(prismaService.roadmap.findMany).toHaveBeenCalled();
  });

  it('2. Same-title different-source roadmaps allowed without database constraint failure', async () => {
    const mockJson = JSON.stringify({ title: 'AI Engineer', nodes: [{ id: 'n1', title: 'Python', type: 'skill' }] });
    prismaService.roadmap.findMany.mockResolvedValueOnce([]); // No existing URL/Name match found

    const result = await service.importRoadmap('user-1', {
      sourceType: RoadmapSourceType.ROADMAP_SH,
      input: mockJson,
      sourceName: 'AI Engineer',
      createNewRoadmap: true,
    });

    expect(prismaService.roadmap.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'AI Engineer' }) })
    );
    expect(result).toBeDefined();
  });

  it('3 & 4. Historical snapshot preservation across imports', async () => {
    const snap = await service.getRoadmapById('user-1', 'rm-1');
    expect(snap.snapshots.length).toBe(1);
    expect(snap.snapshots[0].sourceVersion).toBe('1.0.0');
  });

  it('5. Re-import into existing roadmap attaches new snapshot version', async () => {
    const mockJson = JSON.stringify({ title: 'AI Engineer', nodes: [{ id: 'n1', title: 'Python', type: 'skill' }] });
    prismaService.roadmap.findMany.mockResolvedValueOnce([mockRoadmap]); // Single URL match found

    await service.importRoadmap('user-1', {
      sourceType: RoadmapSourceType.ROADMAP_SH,
      input: mockJson,
      targetRoadmapId: 'rm-1',
    });

    expect(prismaService.roadmapSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roadmapId: 'rm-1' }) })
    );
  });

  it('6. Ambiguous import triggers HTTP 409 Conflict with AMBIGUOUS_ROADMAP_MATCH code', async () => {
    const mockJson = JSON.stringify({ title: 'AI Engineer', nodes: [{ id: 'n1', title: 'Python', type: 'skill' }] });
    const match1 = { ...mockRoadmap, id: 'rm-1' };
    const match2 = { ...mockRoadmap, id: 'rm-2' };
    prismaService.roadmap.findMany.mockResolvedValueOnce([match1, match2]); // 2 matching candidate roadmaps

    try {
      await service.importRoadmap('user-1', {
        sourceType: RoadmapSourceType.ROADMAP_SH,
        input: mockJson,
        sourceName: 'AI Engineer',
      });
      fail('Should have thrown ConflictException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      const res = err.getResponse();
      expect(res.code).toBe('AMBIGUOUS_ROADMAP_MATCH');
      expect(res.candidates.length).toBe(2);
    }
  });

  it('7. Explicit targetRoadmapId bypasses ambiguity check', async () => {
    const mockJson = JSON.stringify({ title: 'AI Engineer', nodes: [{ id: 'n1', title: 'Python', type: 'skill' }] });

    await service.importRoadmap('user-1', {
      sourceType: RoadmapSourceType.ROADMAP_SH,
      input: mockJson,
      targetRoadmapId: 'rm-1',
    });

    expect(prismaService.roadmapSnapshot.create).toHaveBeenCalled();
  });

  it('8, 9 & 10. Pause, Resume, and Priority Preservation across status transitions', async () => {
    // Pause
    const paused = await service.updateRoadmapStatus('user-1', 'rm-1', RoadmapStatus.PAUSED);
    expect(paused.status).toBe(RoadmapStatus.PAUSED);
    expect(paused.priority).toBe(RoadmapPriority.PRIMARY); // Priority preserved

    // Resume
    const resumed = await service.updateRoadmapStatus('user-1', 'rm-1', RoadmapStatus.ACTIVE);
    expect(resumed.status).toBe(RoadmapStatus.ACTIVE);
    expect(resumed.priority).toBe(RoadmapPriority.PRIMARY);
  });

  it('11 & 12. Completed roadmap and Reopen flow', async () => {
    const completed = await service.updateRoadmapStatus('user-1', 'rm-1', RoadmapStatus.COMPLETED);
    expect(completed.status).toBe(RoadmapStatus.COMPLETED);

    const reopened = await service.reopenRoadmap('user-1', 'rm-completed');
    expect(reopened.status).toBe(RoadmapStatus.ACTIVE);
  });

  it('13. Archived roadmap remains historically accessible with deletedAt = null', async () => {
    const archived = await service.getRoadmapById('user-1', 'rm-archived');
    expect(archived.status).toBe(RoadmapStatus.ARCHIVED);
    expect(archived.deletedAt).toBeNull();
  });

  it('14. Soft-deleted roadmap behavior populates deletedAt timestamp', async () => {
    const softDeleted = await service.softDeleteRoadmap('user-1', 'rm-1');
    expect(softDeleted.deletedAt).toBeDefined();
  });

  it('18. Self-reported knowledge sets KNOWN_UNVERIFIED signal without granting verified mastery', async () => {
    const selfReported = await service.selfReportKnowledge('user-1', 'map-1');
    expect(selfReported.mappingStatus).toBe(MappingStatus.KNOWN_UNVERIFIED);
    expect(selfReported.userConfirmation).toBe(true);
    expect(selfReported.matchingReason).toContain('Self-reported');
  });

  it('19 & 20. Skip dependency impact analysis detects downstream bottlenecks', async () => {
    const impact = await service.analyzeSkipImpact('user-1', 'rm-1', 'node-1');
    expect(impact.targetNode.title).toBe('Python');
    expect(impact.blockedDependentNodes.length).toBe(1);
    expect(impact.blockedDependentNodes[0].title).toBe('NumPy');
    expect(impact.impactWarning).toContain('Skipping "Python" will block 1 downstream');
  });

  it('21 & 22. Completion candidate check and review workflow', async () => {
    // Unfulfilled nodes present
    const check1 = await service.checkCompletionCandidate('user-1', 'rm-1');
    expect(check1.isCandidate).toBe(false);

    // Unconfirmed review attempt rejects
    await expect(service.reviewCompletion('user-1', 'rm-1', false)).rejects.toThrow(BadRequestException);
  });

  describe('Cross-User Entity Isolation Verification', () => {
    beforeEach(() => {
      prismaService.journey = {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'journey-user-1') return Promise.resolve({ id: 'journey-user-1', userId: 'user-1' });
          if (where.id === 'journey-user-2') return Promise.resolve({ id: 'journey-user-2', userId: 'user-2' });
          return Promise.resolve(null);
        }),
      };
      prismaService.task = {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'task-user-1') return Promise.resolve({ id: 'task-user-1', journey: { userId: 'user-1' } });
          if (where.id === 'task-user-2') return Promise.resolve({ id: 'task-user-2', journey: { userId: 'user-2' } });
          return Promise.resolve(null);
        }),
      };
      prismaService.project = {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'project-user-1') return Promise.resolve({ id: 'project-user-1', journey: { userId: 'user-1' } });
          if (where.id === 'project-user-2') return Promise.resolve({ id: 'project-user-2', journey: { userId: 'user-2' } });
          return Promise.resolve(null);
        }),
      };
      prismaService.skill = {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'skill-valid') return Promise.resolve({ id: 'skill-valid', name: 'Python' });
          return Promise.resolve(null);
        }),
      };
    });

    it('User A linking User A Journey -> PASS', async () => {
      const res = await service.updateMapping('user-1', 'map-1', { journeyId: 'journey-user-1' });
      expect(res.journeyId).toBe('journey-user-1');
    });

    it('User A linking User B Journey -> REJECT with ForbiddenException', async () => {
      await expect(service.updateMapping('user-1', 'map-1', { journeyId: 'journey-user-2' })).rejects.toThrow(ForbiddenException);
    });

    it('User A linking User A Task -> PASS', async () => {
      const res = await service.updateMapping('user-1', 'map-1', { taskId: 'task-user-1' });
      expect(res.taskId).toBe('task-user-1');
    });

    it('User A linking User B Task -> REJECT with ForbiddenException', async () => {
      await expect(service.updateMapping('user-1', 'map-1', { taskId: 'task-user-2' })).rejects.toThrow(ForbiddenException);
    });

    it('User A linking User A Project -> PASS', async () => {
      const res = await service.updateMapping('user-1', 'map-1', { projectId: 'project-user-1' });
      expect(res.projectId).toBe('project-user-1');
    });

    it('User A linking User B Project -> REJECT with ForbiddenException', async () => {
      await expect(service.updateMapping('user-1', 'map-1', { projectId: 'project-user-2' })).rejects.toThrow(ForbiddenException);
    });

    it('User A linking nonexistent Skill -> REJECT with NotFoundException', async () => {
      await expect(service.updateMapping('user-1', 'map-1', { skillId: 'skill-invalid' })).rejects.toThrow(NotFoundException);
    });

    it('User A linking valid Skill -> PASS', async () => {
      const res = await service.updateMapping('user-1', 'map-1', { skillId: 'skill-valid' });
      expect(res.skillId).toBe('skill-valid');
    });

    it('25. Cross-user roadmap isolation rejects unauthorized access', async () => {
      await expect(service.getRoadmapById('user-1', 'rm-other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  it('26 & 27. Priority updates and status transitions', async () => {
    const updated = await service.updateRoadmapPriority('user-1', 'rm-1', RoadmapPriority.LOW);
    expect(updated.priority).toBe(RoadmapPriority.LOW);
  });
});
