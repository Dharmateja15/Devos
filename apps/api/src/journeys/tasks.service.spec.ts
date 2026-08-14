import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { GamificationService } from '../gamification/gamification.service';
import { AchievementsService } from '../gamification/achievements.service';

describe('TasksService', () => {
  let service: TasksService;
  let mockPrisma: any;
  let mockGamification: any;
  let mockAchievements: any;

  beforeEach(async () => {
    mockPrisma = {
      task: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      milestone: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };
    mockGamification = {
      awardXp: jest.fn().mockResolvedValue(true),
      processStreak: jest.fn().mockResolvedValue(1),
    };
    mockAchievements = {
      evaluateAchievement: jest.fn().mockResolvedValue(true),
      checkStreakAchievements: jest.fn().mockResolvedValue(undefined),
      checkTaskCountAchievements: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GamificationService, useValue: mockGamification },
        { provide: AchievementsService, useValue: mockAchievements },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  describe('completeTask', () => {
    it('should rollback transaction if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);
      await expect(service.completeTask('user-1', 'task-1')).rejects.toThrow(NotFoundException);
    });

    it('should complete task, grant xp, and outbox event successfully', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        milestoneId: 'm1',
        journey: { userId: 'user-1' },
      });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', status: 'DONE' });
      mockPrisma.task.count.mockResolvedValue(1); // incompleteTasksCount

      const result = await service.completeTask('user-1', 't1');
      expect(result.status).toBe('DONE');
      expect(mockGamification.awardXp).toHaveBeenCalledWith(expect.anything(), 10, 't1', 'TASK_COMPLETION', expect.any(String));
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ eventType: 'task.completed' })
      }));
    });

    it('should not award duplicate XP if already DONE', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: 'DONE',
        journey: { userId: 'user-1' },
      });
      const result = await service.completeTask('user-1', 't1');
      expect(result.status).toBe('DONE');
      expect(mockGamification.awardXp).not.toHaveBeenCalled();
    });

    it('should award milestone XP exactly once when milestone completes', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        milestoneId: 'm1',
        journey: { userId: 'user-1' },
      });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', status: 'DONE' });
      mockPrisma.task.count.mockResolvedValue(0); // milestone completes!
      mockPrisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'IN_PROGRESS' });
      
      const result = await service.completeTask('user-1', 't1');
      expect(mockGamification.awardXp).toHaveBeenCalledWith(expect.anything(), 50, 'm1', 'MILESTONE_COMPLETION', expect.any(String));
      expect(mockPrisma.milestone.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DONE' }) }));
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ eventType: 'milestone.completed' })
      }));
    });

    it('should not award milestone XP if milestone already DONE', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        milestoneId: 'm1',
        journey: { userId: 'user-1' },
      });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', status: 'DONE' });
      mockPrisma.task.count.mockResolvedValue(0); 
      mockPrisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'DONE' });
      
      await service.completeTask('user-1', 't1');
      expect(mockGamification.awardXp).toHaveBeenCalledWith(expect.anything(), 10, 't1', 'TASK_COMPLETION', expect.any(String)); // task xp awarded
      expect(mockGamification.awardXp).not.toHaveBeenCalledWith(expect.anything(), 50, 'm1', 'MILESTONE_COMPLETION', expect.any(String)); // milestone xp NOT awarded
      expect(mockPrisma.milestone.update).not.toHaveBeenCalled();
    });
  });

  describe('uncompleteTask', () => {
    it('should uncomplete if inside 5 min window', async () => {
      const now = new Date();
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: 'DONE',
        completedAt: new Date(now.getTime() - 2 * 60000), // 2 mins ago
        journey: { userId: 'user-1' }
      });
      mockPrisma.task.update.mockResolvedValue({ status: 'IN_PROGRESS' });
      const result = await service.uncompleteTask('user-1', 't1');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw if outside 5 min window', async () => {
      const now = new Date();
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: 'DONE',
        completedAt: new Date(now.getTime() - 10 * 60000), // 10 mins ago
        journey: { userId: 'user-1' }
      });
      await expect(service.uncompleteTask('user-1', 't1')).rejects.toThrow(BadRequestException);
    });
  });
});
