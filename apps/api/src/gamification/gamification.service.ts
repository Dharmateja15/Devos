import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GamificationContext {
  userId: string;
  journeyId?: string | null;
  prismaTx: any;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Awards XP to a user if not already awarded for the given source (idempotent).
   */
  async awardXp(
    ctx: GamificationContext,
    amount: number,
    sourceId: string,
    sourceType: string,
    note?: string,
  ): Promise<boolean> {
    if (amount <= 0) return false;

    const { userId, journeyId, prismaTx } = ctx;

    // Check idempotency: Has this source already awarded XP?
    const existing = await prismaTx.xpLedger.findFirst({
      where: {
        userId,
        sourceId,
        sourceType,
      },
    });

    if (existing) {
      this.logger.debug(`XP already awarded for ${sourceType}:${sourceId}`);
      return false;
    }

    // Determine current balance
    const lastEntry = await prismaTx.xpLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const balanceAfter = (lastEntry?.balanceAfter || 0) + amount;

    // Create ledger entry
    await prismaTx.xpLedger.create({
      data: {
        userId,
        journeyId: journeyId || null,
        sourceType,
        sourceId,
        xpDelta: amount,
        balanceAfter,
        note,
      },
    });

    return true;
  }

  /**
   * Processes a streak increment for the user.
   * Ensures maximum 1 streak increment per calendar day (UTC by default, or could use user timezone).
   */
  async processStreak(
    ctx: GamificationContext,
    date: Date,
  ): Promise<number> {
    const { userId, journeyId, prismaTx } = ctx;
    
    // Fetch user to get timezone
    const user = await prismaTx.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timezone = user?.timezone || 'UTC';

    // Get local date string in user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;

    // Normalize date to start of day based on user's local day
    const normalizedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    // Try to record history; if it fails due to unique constraint, we already processed today
    const existingHistory = await prismaTx.streakHistory.findUnique({
      where: {
        userId_date: {
          userId,
          date: normalizedDate,
        },
      },
    });

    if (existingHistory) {
      // Already recorded activity for this day, streak does not inflate.
      const existingStreak = await prismaTx.streak.findFirst({ where: { userId } });
      return existingStreak?.currentStreak || 0;
    }

    // Record activity
    await prismaTx.streakHistory.create({
      data: {
        userId,
        date: normalizedDate,
      },
    });

    // Get current streak
    let streak = await prismaTx.streak.findFirst({
      where: { userId },
    });

    if (!streak) {
      streak = await prismaTx.streak.create({
        data: {
          userId,
          journeyId: journeyId || null,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    }

    let newCurrent = streak.currentStreak;
    let newLongest = streak.longestStreak;

    if (streak.lastActivityDate) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffMs = normalizedDate.getTime() - streak.lastActivityDate.getTime();
      const diffDays = Math.round(diffMs / msPerDay);

      if (diffDays === 1) {
        newCurrent += 1; // Consecutive day
      } else if (diffDays > 1) {
        newCurrent = 1; // Streak broken
      }
      // If diffDays === 0, handled by StreakHistory unique check earlier
    } else {
      newCurrent = 1; // First day
    }

    if (newCurrent > newLongest) {
      newLongest = newCurrent;
    }

    await prismaTx.streak.update({
      where: { id: streak.id },
      data: {
        currentStreak: newCurrent,
        longestStreak: newLongest,
        lastActivityDate: normalizedDate,
      },
    });

    return newCurrent;
  }
}
