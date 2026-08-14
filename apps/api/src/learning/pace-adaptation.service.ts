import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';

export type PaceState = 'LOW_ACTIVITY' | 'STEADY' | 'HIGH_ACTIVITY';

export interface PaceAdaptationDto {
  userId: string;
  evaluatedAt: Date;
  paceState: PaceState;
  weeklyVelocity: number;
  tasksCompletedLast14Days: number;
  taskSkipRate: number;
  overdueTasks: number;
  horizonDays: number;
  suggestedBatchSize: number;
  whyReason: string;
}

export interface RoadmapPaceAdaptationDto extends PaceAdaptationDto {
  roadmapId: string;
  roadmapTitle: string;
}

@Injectable()
export class PaceAdaptationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requirement Y: Pure Read-Only Behavioral Pace Adaptation
   */
  async getPaceAdaptation(userId: string): Promise<PaceAdaptationDto> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch active user tasks
    const allUserTasks = await this.prisma.task.findMany({
      where: { journey: { userId }, deletedAt: null },
    });

    // 14-day evaluation task window (tasks created in last 14 days)
    const windowTasks = allUserTasks.filter(t => t.createdAt >= fourteenDaysAgo);
    const nWindow = windowTasks.length;

    // Completed tasks in last 14 days
    const completedWindowTasks = allUserTasks.filter(
      t => t.status === TaskStatus.DONE && t.completedAt && t.completedAt >= fourteenDaysAgo
    );
    const tasksCompletedLast14Days = completedWindowTasks.length;

    // Skipped tasks in last 14 days evaluation window
    const skippedWindowTasks = windowTasks.filter(t => t.status === TaskStatus.SKIPPED);
    const nSkipped = skippedWindowTasks.length;

    // Mathematical calculations
    const weeklyVelocity = Math.round((tasksCompletedLast14Days / 2.0) * 100) / 100;
    const taskSkipRate = nWindow > 0 ? Math.round((nSkipped / nWindow) * 100) / 100 : 0.0;

    // Overdue tasks count (active tasks where dueDate < now and status !== DONE)
    const overdueTasks = allUserTasks.filter(
      t => t.dueDate && t.dueDate < now && t.status !== TaskStatus.DONE
    ).length;

    // Exact Precedence Evaluation
    let paceState: PaceState = 'LOW_ACTIVITY';
    let horizonDays = 3;
    let suggestedBatchSize = 1;
    let whyReason = '';

    if (taskSkipRate > 0.50) {
      paceState = 'LOW_ACTIVITY';
      horizonDays = 3;
      suggestedBatchSize = 1;
      whyReason = `High task skip rate (${(taskSkipRate * 100).toFixed(0)}% > 50%) takes precedence. Pace set to LOW_ACTIVITY (Batch size: 1, Horizon: 3 days).`;
    } else if (weeklyVelocity > 5.0 && overdueTasks >= 2) {
      paceState = 'STEADY';
      horizonDays = 7;
      suggestedBatchSize = 3;
      whyReason = `High completion velocity (${weeklyVelocity.toFixed(1)} tasks/week), but high overdue task count (${overdueTasks} >= 2) adjusts pace to STEADY (Batch size: 3, Horizon: 7 days).`;
    } else if (weeklyVelocity > 5.0 && taskSkipRate <= 0.50 && overdueTasks <= 1) {
      paceState = 'HIGH_ACTIVITY';
      horizonDays = 14;
      suggestedBatchSize = 5;
      whyReason = `High completion velocity (${weeklyVelocity.toFixed(1)} tasks/week), low skip rate (${(taskSkipRate * 100).toFixed(0)}%), and low overdue count (${overdueTasks}). Pace set to HIGH_ACTIVITY (Batch size: 5, Horizon: 14 days).`;
    } else if (weeklyVelocity >= 2.0 && weeklyVelocity <= 5.0 && taskSkipRate <= 0.50) {
      paceState = 'STEADY';
      horizonDays = 7;
      suggestedBatchSize = 3;
      whyReason = `Steady completion velocity (${weeklyVelocity.toFixed(1)} tasks/week). Pace set to STEADY (Batch size: 3, Horizon: 7 days).`;
    } else {
      paceState = 'LOW_ACTIVITY';
      horizonDays = 3;
      suggestedBatchSize = 1;
      whyReason = `Low completion velocity (${weeklyVelocity.toFixed(1)} < 2.0 tasks/week). Pace set to LOW_ACTIVITY (Batch size: 1, Horizon: 3 days).`;
    }

    // Hard bounds guarantee: 1 <= suggestedBatchSize <= 5
    suggestedBatchSize = Math.max(1, Math.min(5, suggestedBatchSize));

    return {
      userId,
      evaluatedAt: now,
      paceState,
      weeklyVelocity,
      tasksCompletedLast14Days,
      taskSkipRate,
      overdueTasks,
      horizonDays,
      suggestedBatchSize,
      whyReason,
    };
  }

  /**
   * Roadmap Pace Adaptation API with Roadmap Ownership Verification
   */
  async getRoadmapPaceAdaptation(userId: string, roadmapId: string): Promise<RoadmapPaceAdaptationDto> {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
    });

    if (!roadmap || roadmap.deletedAt !== null) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found.`);
    }

    if (roadmap.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view pace adaptation for this roadmap.');
    }

    const baseAdaptation = await this.getPaceAdaptation(userId);

    return {
      ...baseAdaptation,
      roadmapId: roadmap.id,
      roadmapTitle: roadmap.title,
    };
  }
}
