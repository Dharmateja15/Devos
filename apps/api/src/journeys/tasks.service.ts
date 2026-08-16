import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GamificationService,
  GamificationContext,
} from '../gamification/gamification.service';
import { AchievementsService } from '../gamification/achievements.service';
import { IndependenceSignal } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly achievements: AchievementsService,
  ) {}

  private async verifyMilestoneOwnership(userId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { journey: true },
    });
    if (!milestone || milestone.deletedAt || milestone.journey.deletedAt)
      throw new NotFoundException('Milestone not found');
    if (milestone.journey.userId !== userId)
      throw new ForbiddenException('You do not own this milestone');
    return milestone;
  }

  async createTask(
    userId: string,
    milestoneId: string,
    data: { title: string; description?: string },
  ) {
    const milestone = await this.verifyMilestoneOwnership(userId, milestoneId);

    const count = await this.prisma.task.count({
      where: { milestoneId, deletedAt: null },
    });

    return this.prisma.task.create({
      data: {
        journeyId: milestone.journeyId,
        milestoneId,
        title: data.title,
        description: data.description,
        sortOrder: count,
        status: 'TODO',
      },
    });
  }

  async getTasks(
    userId: string,
    milestoneId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    await this.verifyMilestoneOwnership(userId, milestoneId);

    const query: any = {
      where: { milestoneId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      take: limit,
    };
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }

    return this.prisma.task.findMany(query);
  }

  async getTask(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { journey: true },
    });
    if (!task || task.deletedAt || task.journey.deletedAt)
      throw new NotFoundException('Task not found');
    if (task.journey.userId !== userId) throw new ForbiddenException();

    return task;
  }

  async updateTask(
    userId: string,
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: any;
      sortOrder: number;
    }>,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { journey: true },
    });
    if (!task || task.deletedAt || task.journey.deletedAt)
      throw new NotFoundException('Task not found');
    if (task.journey.userId !== userId) throw new ForbiddenException();

    // The primary completion operation is POST /complete.
    // We forbid changing status to DONE or manipulating completedAt here.
    if (data.status === 'DONE') {
      throw new BadRequestException(
        'Use /complete endpoint to mark task as DONE',
      );
    }

    const validStatuses = ['TODO', 'IN_PROGRESS', 'SKIPPED'];
    if (data.status && !validStatuses.includes(data.status)) {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  async deleteTask(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { journey: true },
    });
    if (!task || task.deletedAt || task.journey.deletedAt)
      throw new NotFoundException('Task not found');
    if (task.journey.userId !== userId) throw new ForbiddenException();

    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async completeTask(
    userId: string,
    id: string,
    independenceSignal?: IndependenceSignal,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { journey: true },
    });
    if (!task || task.deletedAt || task.journey.deletedAt)
      throw new NotFoundException('Task not found');
    if (task.journey.userId !== userId) throw new ForbiddenException();

    // Idempotency
    if (task.status === 'DONE') {
      return task;
    }

    if (
      independenceSignal &&
      !Object.values(IndependenceSignal).includes(independenceSignal)
    ) {
      throw new BadRequestException('Invalid independence signal');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark task as DONE
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          status: 'DONE',
          completedAt: new Date(),
          independenceSignal,
        },
      });

      const ctx: GamificationContext = {
        userId,
        journeyId: task.journeyId,
        prismaTx: tx,
      };

      // 2. Award Task XP (+10)
      const xpAwarded = await this.gamification.awardXp(
        ctx,
        10,
        task.id,
        'TASK_COMPLETION',
        'Task completed',
      );

      // 3. Process Streak
      const currentStreak = await this.gamification.processStreak(
        ctx,
        new Date(),
      );
      await this.achievements.checkStreakAchievements(ctx, currentStreak);

      // 4. Evaluate Task Achievements
      await this.achievements.evaluateAchievement(ctx, 'first_task');
      await this.achievements.checkTaskCountAchievements(ctx);

      let milestoneCompleted = false;
      let milestoneXpAwarded = false;

      // 5. Check Milestone Completion
      const incompleteTasksCount = await tx.task.count({
        where: {
          milestoneId: task.milestoneId,
          deletedAt: null,
          status: { not: 'DONE' },
        },
      });

      if (incompleteTasksCount === 0) {
        // Complete the milestone
        const milestone = await tx.milestone.findUnique({
          where: { id: task.milestoneId },
        });
        if (milestone && milestone.status !== 'DONE') {
          await tx.milestone.update({
            where: { id: task.milestoneId },
            data: {
              status: 'DONE',
              completedAt: new Date(),
            },
          });

          milestoneCompleted = true;
          // Award +50 XP
          milestoneXpAwarded = await this.gamification.awardXp(
            ctx,
            50,
            task.milestoneId,
            'MILESTONE_COMPLETION',
            'Milestone completed',
          );

          // Evaluate First Milestone Achievement
          await this.achievements.evaluateAchievement(ctx, 'first_milestone');
        }
      }

      // Check for first journey (if this is the first task of the first journey, we can just evaluate it, it's idempotent)
      await this.achievements.evaluateAchievement(ctx, 'first_journey');

      // Check for journey_complete
      const incompleteJourneyTasks = await tx.task.count({
        where: {
          journeyId: task.journeyId,
          deletedAt: null,
          status: { not: 'DONE' },
        },
      });

      if (incompleteJourneyTasks === 0) {
        await this.achievements.evaluateAchievement(ctx, 'journey_complete');
      }

      // 6. Outbox Events
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'TASK',
          aggregateId: task.id,
          eventType: 'task.completed',
          userId,
          payload: {
            taskId: task.id,
            milestoneId: task.milestoneId,
            journeyId: task.journeyId,
            independenceSignal,
            xpAwarded,
          },
        },
      });

      if (milestoneCompleted) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'MILESTONE',
            aggregateId: task.milestoneId,
            eventType: 'milestone.completed',
            userId,
            payload: {
              milestoneId: task.milestoneId,
              journeyId: task.journeyId,
              xpAwarded: milestoneXpAwarded,
            },
          },
        });
      }

      return updatedTask;
    });
  }

  async uncompleteTask(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { journey: true },
    });
    if (!task || task.deletedAt || task.journey.deletedAt)
      throw new NotFoundException('Task not found');
    if (task.journey.userId !== userId) throw new ForbiddenException();

    if (task.status !== 'DONE' || !task.completedAt) {
      throw new BadRequestException('Task is not completed');
    }

    const completedAt = task.completedAt.getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - completedAt > fiveMinutes) {
      throw new BadRequestException(
        'Uncompletion is only allowed within 5 minutes of completion',
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        status: 'TODO', // Restore to active default
        completedAt: null,
      },
    });
  }
}
