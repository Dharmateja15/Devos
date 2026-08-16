import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      achievement: { findUnique: jest.fn() },
      userAchievement: { findUnique: jest.fn(), create: jest.fn() },
      task: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  it('should evaluate and award achievement idempotently', async () => {
    mockPrisma.achievement.findUnique.mockResolvedValue({
      id: 'a1',
      code: 'first_task',
    });
    mockPrisma.userAchievement.findUnique.mockResolvedValue(null); // not awarded yet

    const result = await service.evaluateAchievement(
      { userId: 'u1', prismaTx: mockPrisma },
      'first_task',
    );
    expect(result).toBe(true);
    expect(mockPrisma.userAchievement.create).toHaveBeenCalled();
  });

  it('should block duplicate achievement award', async () => {
    mockPrisma.achievement.findUnique.mockResolvedValue({
      id: 'a1',
      code: 'first_task',
    });
    mockPrisma.userAchievement.findUnique.mockResolvedValue({ id: 'ua1' }); // already awarded

    const result = await service.evaluateAchievement(
      { userId: 'u1', prismaTx: mockPrisma },
      'first_task',
    );
    expect(result).toBe(false);
    expect(mockPrisma.userAchievement.create).not.toHaveBeenCalled();
  });

  it('should check task count achievements', async () => {
    mockPrisma.task.count.mockResolvedValue(10);
    const evaluateSpy = jest
      .spyOn(service, 'evaluateAchievement')
      .mockResolvedValue(true);

    await service.checkTaskCountAchievements({
      userId: 'u1',
      prismaTx: mockPrisma,
    });

    expect(evaluateSpy).toHaveBeenCalledWith(expect.anything(), 'tasks_10');
    expect(evaluateSpy).not.toHaveBeenCalledWith(expect.anything(), 'tasks_50');
  });

  it('should check streak achievements', async () => {
    const evaluateSpy = jest
      .spyOn(service, 'evaluateAchievement')
      .mockResolvedValue(true);

    await service.checkStreakAchievements(
      { userId: 'u1', prismaTx: mockPrisma },
      7,
    );

    expect(evaluateSpy).toHaveBeenCalledWith(expect.anything(), 'streak_3');
    expect(evaluateSpy).toHaveBeenCalledWith(expect.anything(), 'streak_7');
  });
});
