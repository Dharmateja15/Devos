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
import { EvidenceType } from '@prisma/client';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly achievements: AchievementsService,
  ) {}

  async createEvidence(userId: string, data: any) {
    // 1. Verify relationships
    let journeyId: string | undefined;

    if (data.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: data.taskId },
        include: { journey: true },
      });
      if (!task || task.deletedAt || task.journey.deletedAt)
        throw new NotFoundException('Task not found');
      if (task.journey.userId !== userId)
        throw new ForbiddenException('You do not own this task');
      journeyId = task.journeyId;
    } else if (data.journeyId) {
      const journey = await this.prisma.journey.findUnique({
        where: { id: data.journeyId },
      });
      if (!journey || journey.deletedAt)
        throw new NotFoundException('Journey not found');
      if (journey.userId !== userId)
        throw new ForbiddenException('You do not own this journey');
      journeyId = journey.id;
    } else {
      throw new BadRequestException(
        'Evidence must be attached to a task or journey',
      );
    }

    if (!Object.values(EvidenceType).includes(data.evidenceType)) {
      throw new BadRequestException('Invalid evidence type');
    }

    // 2. Perform transaction
    return this.prisma.$transaction(async (tx) => {
      // Create evidence
      const evidence = await tx.evidenceItem.create({
        data: {
          userId,
          journeyId,
          taskId: data.taskId || null,
          evidenceType: data.evidenceType,
          title: data.title,
          description: data.description,
          url: data.url,
          metadata: data.metadata || {},
        },
      });

      const ctx: GamificationContext = { userId, journeyId, prismaTx: tx };

      // 3. Award XP (+5 XP) ONLY if it's MANUAL evidence attached to a task
      let xpAwarded = false;
      if (data.taskId && data.evidenceType === EvidenceType.MANUAL) {
        const sourceId = data.taskId;
        const sourceType = 'TASK_EVIDENCE';

        xpAwarded = await this.gamification.awardXp(
          ctx,
          5,
          sourceId,
          sourceType,
          'Manual evidence attached to task',
        );
      }

      // Check for first evidence achievement
      await this.achievements.evaluateAchievement(ctx, 'first_evidence');

      // Create Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'EVIDENCE',
          aggregateId: evidence.id,
          eventType: 'evidence.created',
          payload: {
            evidenceId: evidence.id,
            taskId: data.taskId,
            xpAwarded,
          },
          userId,
        },
      });

      return evidence;
    });
  }

  async getEvidence(userId: string, taskId?: string) {
    const where: any = { userId, deletedAt: null };
    if (taskId) where.taskId = taskId;

    return this.prisma.evidenceItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEvidenceById(userId: string, id: string) {
    const evidence = await this.prisma.evidenceItem.findUnique({
      where: { id },
    });
    if (!evidence || evidence.deletedAt)
      throw new NotFoundException('Evidence not found');
    if (evidence.userId !== userId) throw new ForbiddenException();
    return evidence;
  }

  async updateEvidence(userId: string, id: string, data: any) {
    const evidence = await this.getEvidenceById(userId, id);

    return this.prisma.evidenceItem.update({
      where: { id: evidence.id },
      data: {
        title: data.title,
        description: data.description,
        url: data.url,
      },
    });
  }

  async deleteEvidence(userId: string, id: string) {
    const evidence = await this.getEvidenceById(userId, id);

    return this.prisma.evidenceItem.update({
      where: { id: evidence.id },
      data: { deletedAt: new Date() },
    });
  }
}
