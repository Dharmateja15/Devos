import { Test, TestingModule } from '@nestjs/testing';
import {
  GamificationService,
  GamificationContext,
} from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      xpLedger: { findFirst: jest.fn(), create: jest.fn() },
      streakHistory: { findUnique: jest.fn(), create: jest.fn() },
      streak: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  it('should idempotently award XP', async () => {
    mockPrisma.xpLedger.findFirst.mockResolvedValueOnce(null); // existing
    mockPrisma.xpLedger.findFirst.mockResolvedValueOnce({ balanceAfter: 10 }); // lastEntry
    const ctx: GamificationContext = { userId: 'u1', prismaTx: mockPrisma };

    const result = await service.awardXp(ctx, 10, 't1', 'TASK_COMPLETION');

    expect(result).toBe(true);
    expect(mockPrisma.xpLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ xpDelta: 10, balanceAfter: 20 }),
      }),
    );
  });

  it('should not award XP twice for same source', async () => {
    mockPrisma.xpLedger.findFirst.mockResolvedValueOnce({ id: 'existing' }); // existing
    const ctx: GamificationContext = { userId: 'u1', prismaTx: mockPrisma };

    const result = await service.awardXp(ctx, 10, 't1', 'TASK_COMPLETION');

    expect(result).toBe(false);
    expect(mockPrisma.xpLedger.create).not.toHaveBeenCalled();
  });

  it('should process streak in user timezone and handle gaps', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
    mockPrisma.streakHistory.findUnique.mockResolvedValue(null);
    mockPrisma.streak.findFirst.mockResolvedValue({
      id: 's1',
      currentStreak: 2,
      longestStreak: 2,
      lastActivityDate: new Date('2026-08-11T00:00:00.000Z'), // 2 days ago
    });

    const ctx: GamificationContext = { userId: 'u1', prismaTx: mockPrisma };
    const result = await service.processStreak(
      ctx,
      new Date('2026-08-13T01:00:00.000Z'),
    );

    // gap > 1 day, so streak breaks and resets to 1
    expect(result).toBe(1);
    expect(mockPrisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStreak: 1, longestStreak: 2 }),
      }),
    );
  });
});
