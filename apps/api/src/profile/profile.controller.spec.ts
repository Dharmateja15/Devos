import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLevelFromXp, LEVEL_THRESHOLDS } from '@devos/types';

describe('ProfileController & Security Boundary (Phase 6B.2 Correction Pass)', () => {
  let controller: ProfileController;
  let service: ProfileService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
    },
    publicProfile: {
      findUnique: jest.fn(),
    },
    xpLedger: {
      findFirst: jest.fn(),
    },
    streak: {
      findFirst: jest.fn(),
    },
    userAchievement: {
      findMany: jest.fn(),
    },
    journey: {
      findMany: jest.fn(),
    },
    evidenceItem: {
      findMany: jest.fn(),
    },
    streakHistory: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    service = module.get<ProfileService>(ProfileService);
  });

  describe('Single Authoritative Level Calculation Authority', () => {
    it('1. Shared level calculation uses exact approved product thresholds', () => {
      expect(LEVEL_THRESHOLDS).toHaveLength(12);
      expect(LEVEL_THRESHOLDS[0]).toEqual({
        level: 1,
        xp: 0,
        title: 'Newcomer',
      });
      expect(LEVEL_THRESHOLDS[1]).toEqual({
        level: 2,
        xp: 100,
        title: 'Apprentice',
      });
      expect(LEVEL_THRESHOLDS[3]).toEqual({
        level: 4,
        xp: 500,
        title: 'Engineer',
      });
      expect(LEVEL_THRESHOLDS[4]).toEqual({
        level: 5,
        xp: 900,
        title: 'Architect',
      });
      expect(LEVEL_THRESHOLDS[11]).toEqual({
        level: 30,
        xp: 200000,
        title: 'Master',
      });
    });

    it('2. calculateLevelFromXp computes exact level and title without divergence', () => {
      expect(calculateLevelFromXp(0)).toMatchObject({
        level: 1,
        title: 'Newcomer',
      });
      expect(calculateLevelFromXp(500)).toMatchObject({
        level: 4,
        title: 'Engineer',
      });
      expect(calculateLevelFromXp(1200)).toMatchObject({
        level: 5,
        title: 'Architect',
      });
      expect(calculateLevelFromXp(250000)).toMatchObject({
        level: 30,
        title: 'Master',
      });
    });
  });

  describe('GET /api/v1/p/:username (Public Profile)', () => {
    it('3. Retrieves public profile when isPublic=true with single level source', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'alexdev',
        displayName: 'Alex Developer',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        isPublic: true,
        headline: 'AI Software Engineer',
        bio: 'Building systems.',
        socialLinks: { github: 'https://github.com/alexdev' },
        featuredJourneyIds: ['j1'],
        totalXp: 500,
        streakCount: 5,
      });

      mockPrisma.xpLedger.findFirst.mockResolvedValue({ balanceAfter: 500 });
      mockPrisma.streak.findFirst.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
      });
      mockPrisma.userAchievement.findMany.mockResolvedValue([
        {
          awardedAt: new Date('2026-08-01'),
          achievement: {
            code: 'first_task',
            name: 'First Step',
            description: 'Task done',
            icon: 'flag',
            category: 'tasks',
            xpReward: 10,
            isActive: true,
          },
        },
      ]);

      mockPrisma.journey.findMany.mockResolvedValue([
        {
          id: 'j1',
          title: 'Fullstack Mastery',
          description: 'Learning track',
          status: 'ACTIVE',
          createdAt: new Date(),
          milestones: [{ id: 'm1', status: 'DONE' }],
          tasks: [{ id: 't1', status: 'DONE' }],
        },
      ]);

      mockPrisma.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'e1',
          evidenceType: 'GITHUB_REPO',
          title: 'DevOS Repo',
          githubRepo: 'alexdev/devos',
          githubSha: null,
          url: 'https://github.com/alexdev/devos',
          createdAt: new Date(),
        },
      ]);

      const res = await controller.getPublicProfile('alexdev');

      expect(res.identity.username).toBe('alexdev');
      expect(res.identity.displayName).toBe('Alex Developer');
      expect(res.gamification.totalXp).toBe(500);
      expect(res.gamification.level).toBe(4); // 500 XP = Level 4 Engineer
      expect(res.gamification.levelTitle).toBe('Engineer');
      expect(res.journeys).toHaveLength(1);
      expect(res.proofOfWork).toHaveLength(1);
    });

    it('4. SECURITY: Evidence is queried ONLY when verified=true AND journey.visibility=PUBLIC', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'evidenceuser',
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        isPublic: true,
      });
      mockPrisma.xpLedger.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findFirst.mockResolvedValue(null);
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.journey.findMany.mockResolvedValue([]);
      mockPrisma.evidenceItem.findMany.mockResolvedValue([]);

      await controller.getPublicProfile('evidenceuser');

      expect(mockPrisma.evidenceItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verified: true,
            journey: expect.objectContaining({ visibility: 'PUBLIC' }),
          }),
        }),
      );
    });

    it('5. SECURITY: Only PUBLIC journeys are included; PRIVATE / RECRUITER journeys excluded', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'journeyuser',
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        isPublic: true,
        featuredJourneyIds: ['j-private'],
      });
      mockPrisma.xpLedger.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findFirst.mockResolvedValue(null);
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.journey.findMany.mockResolvedValue([
        {
          id: 'j-public',
          title: 'Public Track',
          description: 'Open track',
          status: 'ACTIVE',
          createdAt: new Date(),
          milestones: [],
          tasks: [],
        },
      ]);
      mockPrisma.evidenceItem.findMany.mockResolvedValue([]);

      const res = await controller.getPublicProfile('journeyuser');

      expect(mockPrisma.journey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ visibility: 'PUBLIC' }),
        }),
      );
      expect(res.journeys).toHaveLength(1);
      expect(res.journeys[0].id).toBe('j-public');
    });

    it('6. SECURITY: Email, passwordHash, role, and OAuth tokens are NEVER present', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'secureuser',
        displayName: 'Secure',
        avatarUrl: null,
      });

      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        isPublic: true,
      });
      mockPrisma.xpLedger.findFirst.mockResolvedValue(null);
      mockPrisma.streak.findFirst.mockResolvedValue(null);
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.journey.findMany.mockResolvedValue([]);
      mockPrisma.evidenceItem.findMany.mockResolvedValue([]);

      const res = (await controller.getPublicProfile('secureuser')) as any;

      expect(res.identity.email).toBeUndefined();
      expect(res.identity.passwordHash).toBeUndefined();
      expect(res.identity.role).toBeUndefined();
      expect(res.identity.refreshTokenHash).toBeUndefined();
      expect(res.oauthAccounts).toBeUndefined();
    });

    it('7. Throws 404 if profile is private (isPublic=false)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        username: 'privateuser',
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u2',
        isPublic: false,
      });

      await expect(controller.getPublicProfile('privateuser')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('8. Throws 404 if user is deleted or does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(controller.getPublicProfile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /api/v1/p/:username/activity (52-Week Activity)', () => {
    it('9. Retrieves 52-week activity history dates derived from StreakHistory', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'activeuser',
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        isPublic: true,
      });

      const d1 = new Date('2026-08-10');
      const d2 = new Date('2026-08-15');
      mockPrisma.streakHistory.findMany.mockResolvedValue([
        { date: d1 },
        { date: d2 },
      ]);

      const res = await controller.getPublicActivity('activeuser');

      expect(res.username).toBe('activeuser');
      expect(res.activityDates).toHaveLength(2);
      expect(res.activityDates[0].date).toBe('2026-08-10');
      expect(res.activityDates[0].count).toBe(1);
    });

    it('10. Throws 404 for activity request when profile is private', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        username: 'privateuser',
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u2',
        isPublic: false,
      });

      await expect(controller.getPublicActivity('privateuser')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
