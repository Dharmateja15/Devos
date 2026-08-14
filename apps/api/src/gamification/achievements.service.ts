import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationContext } from './gamification.service';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if a specific achievement is unlocked for a user.
   * If unlocked, awards the achievement idempotently.
   */
  async evaluateAchievement(
    ctx: GamificationContext,
    achievementCode: string,
  ): Promise<boolean> {
    const { userId, journeyId, prismaTx } = ctx;

    const achievementDef = await prismaTx.achievement.findUnique({
      where: { code: achievementCode },
    });

    if (!achievementDef) {
      this.logger.debug(`Achievement definition for ${achievementCode} not found in DB`);
      return false; // Skip if it doesn't exist
    }

    // Idempotency check
    const existingAward = await prismaTx.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievementDef.id,
        },
      },
    });

    if (existingAward) {
      return false; // Already unlocked
    }

    // Record unlock
    await prismaTx.userAchievement.create({
      data: {
        userId,
        achievementId: achievementDef.id,
        journeyId: journeyId || null,
      },
    });

    return true;
  }

  /**
   * Checks task count achievements (tasks_10, tasks_50)
   */
  async checkTaskCountAchievements(ctx: GamificationContext): Promise<void> {
    const { userId, prismaTx } = ctx;
    const taskCount = await prismaTx.task.count({
      where: {
        journey: { userId },
        status: 'DONE',
        deletedAt: null,
      },
    });

    if (taskCount >= 10) await this.evaluateAchievement(ctx, 'tasks_10');
    if (taskCount >= 50) await this.evaluateAchievement(ctx, 'tasks_50');
  }

  /**
   * Checks streak achievements (streak_3, streak_7)
   */
  async checkStreakAchievements(ctx: GamificationContext, currentStreak: number): Promise<void> {
    if (currentStreak >= 3) await this.evaluateAchievement(ctx, 'streak_3');
    if (currentStreak >= 7) await this.evaluateAchievement(ctx, 'streak_7');
  }
}
