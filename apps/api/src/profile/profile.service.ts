import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateLevelFromXp } from './level-calculator';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Internal lookup helper.
   * Verifies user exists (deletedAt is null) and has a PublicProfile with isPublic = true.
   * Throws 404 NotFoundException for missing or private profiles to prevent sensitive enumeration.
   */
  private async getPublicUserAndProfile(username: string) {
    if (!username || !username.trim()) {
      throw new NotFoundException('Profile not found');
    }

    const cleanUsername = username.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: 'insensitive' },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Profile not found');
    }

    const publicProfile = await this.prisma.publicProfile.findUnique({
      where: { userId: user.id },
    });

    if (!publicProfile || !publicProfile.isPublic) {
      throw new NotFoundException('Profile not found');
    }

    return { user, publicProfile };
  }

  /**
   * GET /api/v1/p/:username
   * Returns sanitized public profile information.
   */
  async getPublicProfile(username: string) {
    const { user, publicProfile } =
      await this.getPublicUserAndProfile(username);

    // 1. XP Summary
    const lastXpEntry = await this.prisma.xpLedger.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const totalXp = lastXpEntry?.balanceAfter || publicProfile.totalXp || 0;
    const { level, title: levelTitle } = calculateLevelFromXp(totalXp);

    // 2. Streak Summary
    const streakRecord = await this.prisma.streak.findFirst({
      where: { userId: user.id },
    });
    const currentStreak =
      streakRecord?.currentStreak || publicProfile.streakCount || 0;
    const longestStreak = streakRecord?.longestStreak || 0;

    // 3. Earned Achievements Only
    const userAwards = await this.prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true },
      orderBy: { awardedAt: 'desc' },
    });

    const earnedAchievements = userAwards
      .filter((award) => award.achievement && award.achievement.isActive)
      .map((award) => ({
        code: award.achievement.code,
        name: award.achievement.name,
        description: award.achievement.description,
        icon: award.achievement.icon,
        category: award.achievement.category,
        xpReward: award.achievement.xpReward,
        earnedAt: award.awardedAt,
      }));

    // 4. Public Journeys Only
    const featuredSet = new Set(publicProfile.featuredJourneyIds || []);

    const publicJourneys = await this.prisma.journey.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        visibility: 'PUBLIC',
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        milestones: {
          where: { deletedAt: null },
          select: { id: true, status: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedJourneys = publicJourneys.map((j) => {
      const milestonesCount = j.milestones.length;
      const completedMilestonesCount = j.milestones.filter(
        (m) => m.status === 'DONE',
      ).length;
      const tasksCount = j.tasks.length;
      const completedTasksCount = j.tasks.filter(
        (t) => t.status === 'DONE',
      ).length;

      return {
        id: j.id,
        title: j.title,
        description: j.description,
        status: j.status,
        isFeatured: featuredSet.has(j.id),
        milestonesCount,
        completedMilestonesCount,
        tasksCount,
        completedTasksCount,
      };
    });

    // 5. Verified Proof of Work Evidence (only if verified AND attached to a PUBLIC journey)
    const verifiedEvidence = await this.prisma.evidenceItem.findMany({
      where: {
        userId: user.id,
        verified: true,
        deletedAt: null,
        journey: {
          visibility: 'PUBLIC',
          deletedAt: null,
        },
      },
      select: {
        id: true,
        evidenceType: true,
        title: true,
        githubRepo: true,
        githubSha: true,
        url: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      identity: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        headline: publicProfile.headline || null,
        bio: publicProfile.bio || null,
        socialLinks: publicProfile.socialLinks || {},
      },
      gamification: {
        totalXp,
        level,
        levelTitle,
        currentStreak,
        longestStreak,
        earnedAchievements,
      },
      journeys: formattedJourneys,
      proofOfWork: verifiedEvidence,
    };
  }

  /**
   * GET /api/v1/p/:username/activity
   * Returns 52-week activity dataset derived from StreakHistory.
   */
  async getPublicActivity(username: string) {
    const { user } = await this.getPublicUserAndProfile(username);

    const now = new Date();
    const fiftyTwoWeeksAgo = new Date(
      now.getTime() - 364 * 24 * 60 * 60 * 1000,
    );

    const historyRecords = await this.prisma.streakHistory.findMany({
      where: {
        userId: user.id,
        date: { gte: fiftyTwoWeeksAgo },
      },
      select: {
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    const activityDates = historyRecords.map((r) => {
      const d = new Date(r.date);
      return {
        date: d.toISOString().split('T')[0],
        count: 1,
      };
    });

    return {
      username: user.username,
      activityWindow: {
        startDate: fiftyTwoWeeksAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      },
      activityDates,
    };
  }
}
