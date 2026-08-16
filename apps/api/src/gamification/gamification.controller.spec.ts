import { Test, TestingModule } from '@nestjs/testing';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { AchievementsService } from './achievements.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamificationController & Read API', () => {
  let controller: GamificationController;
  let gamificationService: GamificationService;
  let achievementsService: AchievementsService;

  const mockPrisma = {
    xpLedger: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    achievement: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userAchievement: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    streak: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    streakHistory: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        GamificationService,
        AchievementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<GamificationController>(GamificationController);
    gamificationService = module.get<GamificationService>(GamificationService);
    achievementsService = module.get<AchievementsService>(AchievementsService);
  });

  describe('GET /api/v1/me/xp', () => {
    it('1. Authenticated user can retrieve their XP summary', async () => {
      mockPrisma.xpLedger.findFirst.mockResolvedValue({ balanceAfter: 150 });
      mockPrisma.xpLedger.aggregate
        .mockResolvedValueOnce({ _sum: { xpDelta: 50 } }) // weekly
        .mockResolvedValueOnce({ _sum: { xpDelta: 150 } }); // monthly

      const now = new Date();
      mockPrisma.xpLedger.findMany.mockResolvedValue([
        {
          id: 'x1',
          sourceType: 'TASK_COMPLETION',
          sourceId: 't1',
          xpDelta: 10,
          balanceAfter: 150,
          note: 'Task done',
          createdAt: now,
        },
      ]);

      const result = await controller.getXpSummary({ id: 'user-123' });

      expect(result.totalXp).toBe(150);
      expect(result.weeklyXp).toBe(50);
      expect(result.monthlyXp).toBe(150);
      expect(result.recentEntries).toHaveLength(1);
      expect(result.recentEntries[0].id).toBe('x1');
      expect(mockPrisma.xpLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-123' } }),
      );
    });

    it('2. XP ledger entries belong only to the authenticated user', async () => {
      mockPrisma.xpLedger.findFirst.mockResolvedValue(null);
      mockPrisma.xpLedger.aggregate.mockResolvedValue({
        _sum: { xpDelta: null },
      });
      mockPrisma.xpLedger.findMany.mockResolvedValue([]);

      await controller.getXpSummary({ id: 'user-789' });

      expect(mockPrisma.xpLedger.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-789' } }),
      );
      expect(mockPrisma.xpLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-789' } }),
      );
    });

    it('3. Returns 0 for total, weekly, and monthly XP when user has no entries', async () => {
      mockPrisma.xpLedger.findFirst.mockResolvedValue(null);
      mockPrisma.xpLedger.aggregate.mockResolvedValue({
        _sum: { xpDelta: null },
      });
      mockPrisma.xpLedger.findMany.mockResolvedValue([]);

      const result = await controller.getXpSummary({ id: 'new-user' });

      expect(result.totalXp).toBe(0);
      expect(result.weeklyXp).toBe(0);
      expect(result.monthlyXp).toBe(0);
      expect(result.recentEntries).toEqual([]);
    });
  });

  describe('GET /api/v1/me/achievements', () => {
    it('4. Authenticated user receives all active achievement definitions with earned/locked status', async () => {
      const awardDate = new Date('2026-08-01T12:00:00Z');

      mockPrisma.achievement.findMany.mockResolvedValue([
        {
          id: 'ach-1',
          code: 'first_task',
          name: 'First Step',
          description: 'Complete your first task',
          icon: 'flag',
          category: 'tasks',
          xpReward: 10,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'ach-2',
          code: 'streak_7',
          name: 'Week Warrior',
          description: 'Reach a 7 day streak',
          icon: 'fire',
          category: 'streaks',
          xpReward: 50,
          isActive: true,
          createdAt: new Date(),
        },
      ]);

      mockPrisma.userAchievement.findMany.mockResolvedValue([
        {
          achievementId: 'ach-1',
          awardedAt: awardDate,
        },
      ]);

      const result = await controller.getAchievementsCatalogue({
        id: 'user-123',
      });

      expect(result).toHaveLength(2);

      // Earned achievement
      expect(result[0].id).toBe('ach-1');
      expect(result[0].code).toBe('first_task');
      expect(result[0].earned).toBe(true);
      expect(result[0].earnedAt).toEqual(awardDate);

      // Locked achievement
      expect(result[1].id).toBe('ach-2');
      expect(result[1].code).toBe('streak_7');
      expect(result[1].earned).toBe(false);
      expect(result[1].earnedAt).toBeNull();

      expect(mockPrisma.userAchievement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-123' } }),
      );
    });

    it('5. User cannot query another user achievements', async () => {
      mockPrisma.achievement.findMany.mockResolvedValue([]);
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);

      await controller.getAchievementsCatalogue({ id: 'user-456' });

      expect(mockPrisma.userAchievement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-456' } }),
      );
    });
  });
});
