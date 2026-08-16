import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationSuppressionService } from './recommendation-suppression.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, TaskStatus } from '@prisma/client';

describe('RecommendationSuppressionService (Sub-Block 6D - Requirement R)', () => {
  let service: RecommendationSuppressionService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      learnerConceptState: { findMany: jest.fn().mockResolvedValue([]) },
      evidenceItem: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationSuppressionService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<RecommendationSuppressionService>(
      RecommendationSuppressionService,
    );
  });

  describe('Observable Suppression & Invariants', () => {
    it('1. Suppresses recommendations for explicit concept SKIP choice', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-py',
          state: LearnerState.SELF_REPORTED,
          userIntent: 'SKIP',
          concept: { id: 'c-py', title: 'Python' },
        },
      ]);

      const res = await service.getSuppressionStatus('user-1');

      expect(res.suppressionList.length).toBe(1);
      const py = res.suppressionList[0];
      expect(py.conceptTitle).toBe('Python');
      expect(py.isSuppressed).toBe(true);
      expect(py.suppressionType).toBe('SKIP');
    });

    it('2. Suppresses recommendations for explicit concept DEFER choice until date passes', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 5); // 5 days in future

      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-docker',
          state: LearnerState.SELF_REPORTED,
          userIntent: 'DEFER',
          nextReviewAt: futureDate,
          concept: { id: 'c-docker', title: 'Docker' },
        },
      ]);

      const res = await service.getSuppressionStatus('user-1');

      expect(res.suppressionList.length).toBe(1);
      const docker = res.suppressionList[0];
      expect(docker.conceptTitle).toBe('Docker');
      expect(docker.isSuppressed).toBe(true);
      expect(docker.suppressionType).toBe('DEFER');
      expect(docker.deferUntil).toEqual(futureDate);
    });

    it('3. Reduces recommendation priority when associated task is marked SKIPPED', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-ts',
          state: LearnerState.UNKNOWN,
          concept: { id: 'c-ts', title: 'TypeScript' },
        },
      ]);

      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-ts-skip',
          status: TaskStatus.SKIPPED,
          skills: [{ skill: { name: 'TypeScript' } }],
        },
      ]);

      const res = await service.getSuppressionStatus('user-1');

      const ts = res.suppressionList[0];
      expect(ts.conceptTitle).toBe('TypeScript');
      expect(ts.isSuppressed).toBe(false);
      expect(ts.priorityReduced).toBe(true);
      expect(ts.suppressionType).toBe('TASK_SKIPPED');
    });

    it('4. Invariant Check: Does NOT fabricate unobservable UI presentation ignore counts', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-py',
          state: LearnerState.UNKNOWN,
          concept: { id: 'c-py', title: 'Python' },
        },
      ]);

      const res = await service.getSuppressionStatus('user-1');

      const item: any = res.suppressionList[0];
      expect(item.ignoreCount).toBeUndefined();
      expect(item.impressionCount).toBeUndefined();
      expect(item.isSuppressed).toBe(false);
    });

    it('5. Dynamic Reset: New verified evidence resets concept suppression', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-py',
          state: LearnerState.SELF_REPORTED,
          userIntent: 'SKIP',
          concept: { id: 'c-py', title: 'Python' },
        },
      ]);

      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-new',
          verified: true,
          metadata: { detectedTechnologies: ['Python'] },
        },
      ]);

      const res = await service.getSuppressionStatus('user-1');

      const py = res.suppressionList[0];
      expect(py.isSuppressed).toBe(false); // Reset dynamically!
      expect(py.suppressionType).toBe('ACTIVE');
    });

    it('6. Invariant Check: Zero database write operations executed during suppression analysis', async () => {
      await service.getSuppressionStatus('user-1');

      expect(prismaService.learnerConceptState.update).toBeUndefined();
      expect(prismaService.task.update).toBeUndefined();
    });
  });
});
