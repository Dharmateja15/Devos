import { Test, TestingModule } from '@nestjs/testing';
import { PaceAdaptationService } from './pace-adaptation.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('PaceAdaptationService (Sub-Block 6D - Requirement Y)', () => {
  let service: PaceAdaptationService;
  let prismaService: any;

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const mockRoadmap = {
    id: 'rm-1',
    userId: 'user-1',
    title: 'Data Engineering',
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      task: { findMany: jest.fn().mockResolvedValue([]) },
      roadmap: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === 'rm-1') return Promise.resolve(mockRoadmap);
          if (where.id === 'rm-other') return Promise.resolve({ ...mockRoadmap, id: 'rm-other', userId: 'user-other' });
          return Promise.resolve(null);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaceAdaptationService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<PaceAdaptationService>(PaceAdaptationService);
  });

  describe('Deterministic Boundary Tests & Mathematical Formulas', () => {
    it('1. 0 tasks completed / 14d -> weeklyVelocity = 0.0 -> LOW_ACTIVITY (Batch size = 1)', async () => {
      prismaService.task.findMany.mockResolvedValue([]);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(0.0);
      expect(res.paceState).toBe('LOW_ACTIVITY');
      expect(res.suggestedBatchSize).toBe(1);
      expect(res.horizonDays).toBe(3);
    });

    it('2. 1 task completed / 14d -> weeklyVelocity = 0.5 -> LOW_ACTIVITY (Batch size = 1)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        { id: 't-1', status: TaskStatus.DONE, createdAt: daysAgo(5), completedAt: daysAgo(2) },
      ]);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(0.5);
      expect(res.paceState).toBe('LOW_ACTIVITY');
      expect(res.suggestedBatchSize).toBe(1);
    });

    it('3. 3 tasks completed / 14d -> weeklyVelocity = 1.5 -> LOW_ACTIVITY (Batch size = 1)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        { id: 't-1', status: TaskStatus.DONE, createdAt: daysAgo(10), completedAt: daysAgo(8) },
        { id: 't-2', status: TaskStatus.DONE, createdAt: daysAgo(7), completedAt: daysAgo(5) },
        { id: 't-3', status: TaskStatus.DONE, createdAt: daysAgo(4), completedAt: daysAgo(2) },
      ]);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(1.5);
      expect(res.paceState).toBe('LOW_ACTIVITY');
      expect(res.suggestedBatchSize).toBe(1);
    });

    it('4. 4 tasks completed / 14d -> weeklyVelocity = 2.0 (Exact boundary) -> STEADY (Batch size = 3)', async () => {
      const tasks = Array.from({ length: 4 }, (_, i) => ({
        id: `t-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(10),
        completedAt: daysAgo(i + 1),
      }));
      prismaService.task.findMany.mockResolvedValue(tasks);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(2.0);
      expect(res.paceState).toBe('STEADY');
      expect(res.suggestedBatchSize).toBe(3);
      expect(res.horizonDays).toBe(7);
    });

    it('5. 10 tasks completed / 14d -> weeklyVelocity = 5.0 (Exact boundary) -> STEADY (Batch size = 3)', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `t-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(12),
        completedAt: daysAgo(i + 1),
      }));
      prismaService.task.findMany.mockResolvedValue(tasks);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(5.0);
      expect(res.paceState).toBe('STEADY');
      expect(res.suggestedBatchSize).toBe(3);
      expect(res.horizonDays).toBe(7);
    });

    it('6. 11 tasks completed / 14d -> weeklyVelocity = 5.5 -> HIGH_ACTIVITY (Batch size = 5)', async () => {
      const tasks = Array.from({ length: 11 }, (_, i) => ({
        id: `t-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(12),
        completedAt: daysAgo(i + 1),
      }));
      prismaService.task.findMany.mockResolvedValue(tasks);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(5.5);
      expect(res.paceState).toBe('HIGH_ACTIVITY');
      expect(res.suggestedBatchSize).toBe(5);
      expect(res.horizonDays).toBe(14);
    });

    it('7. High skip rate (> 50%) overrides high velocity -> LOW_ACTIVITY', async () => {
      // 12 tasks completed in 14d (velocity = 6.0), but 13 tasks skipped out of 25 total window tasks (skipRate = 52%)
      const completedTasks = Array.from({ length: 12 }, (_, i) => ({
        id: `tc-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(10),
        completedAt: daysAgo(i + 1),
      }));
      const skippedTasks = Array.from({ length: 13 }, (_, i) => ({
        id: `ts-${i}`,
        status: TaskStatus.SKIPPED,
        createdAt: daysAgo(10),
      }));

      prismaService.task.findMany.mockResolvedValue([...completedTasks, ...skippedTasks]);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(6.0);
      expect(res.taskSkipRate).toBe(0.52);
      expect(res.paceState).toBe('LOW_ACTIVITY'); // High skip rate precedence!
      expect(res.suggestedBatchSize).toBe(1);
    });

    it('8. High overdue burden (>= 2) prevents HIGH_ACTIVITY -> STEADY', async () => {
      // 12 tasks completed in 14d (velocity = 6.0), but 2 tasks overdue
      const completedTasks = Array.from({ length: 12 }, (_, i) => ({
        id: `tc-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(10),
        completedAt: daysAgo(i + 1),
      }));
      const overdueTasks = [
        { id: 'to-1', status: TaskStatus.TODO, dueDate: daysAgo(2), createdAt: daysAgo(10) },
        { id: 'to-2', status: TaskStatus.TODO, dueDate: daysAgo(1), createdAt: daysAgo(10) },
      ];

      prismaService.task.findMany.mockResolvedValue([...completedTasks, ...overdueTasks]);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(6.0);
      expect(res.overdueTasks).toBe(2);
      expect(res.paceState).toBe('STEADY'); // High overdue count caps pace at STEADY!
      expect(res.suggestedBatchSize).toBe(3);
    });

    it('9. High velocity + low skip + low overdue -> HIGH_ACTIVITY', async () => {
      const completedTasks = Array.from({ length: 12 }, (_, i) => ({
        id: `tc-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(10),
        completedAt: daysAgo(i + 1),
      }));

      prismaService.task.findMany.mockResolvedValue(completedTasks);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.weeklyVelocity).toBe(6.0);
      expect(res.overdueTasks).toBe(0);
      expect(res.taskSkipRate).toBe(0.0);
      expect(res.paceState).toBe('HIGH_ACTIVITY');
      expect(res.suggestedBatchSize).toBe(5);
    });

    it('10. Zero-task evaluation window denominator (N_window = 0) -> taskSkipRate = 0.0 (No NaN)', async () => {
      prismaService.task.findMany.mockResolvedValue([]);

      const res = await service.getPaceAdaptation('user-1');

      expect(res.taskSkipRate).toBe(0.0);
      expect(isNaN(res.taskSkipRate)).toBe(false);
    });

    it('11. Suggested batch size is strictly bounded between 1 and 5', async () => {
      const resLow = await service.getPaceAdaptation('user-1');
      expect(resLow.suggestedBatchSize).toBeGreaterThanOrEqual(1);
      expect(resLow.suggestedBatchSize).toBeLessThanOrEqual(5);

      const completedTasks = Array.from({ length: 30 }, (_, i) => ({
        id: `tc-${i}`,
        status: TaskStatus.DONE,
        createdAt: daysAgo(10),
        completedAt: daysAgo(1),
      }));
      prismaService.task.findMany.mockResolvedValue(completedTasks);

      const resHigh = await service.getPaceAdaptation('user-1');
      expect(resHigh.suggestedBatchSize).toBe(5); // Hard cap at 5!
    });

    it('12. Invariant Check: Zero database write or task creation calls', async () => {
      await service.getPaceAdaptation('user-1');

      expect(prismaService.task.create).toBeUndefined();
      expect(prismaService.task.update).toBeUndefined();
      expect(prismaService.task.delete).toBeUndefined();
    });

    it('13. Roadmap Pace Adaptation checks ownership and throws ForbiddenException for non-owners', async () => {
      await expect(
        service.getRoadmapPaceAdaptation('user-1', 'rm-other')
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
