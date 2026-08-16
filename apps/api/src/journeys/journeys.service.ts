import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JourneysService {
  constructor(private readonly prisma: PrismaService) {}

  async createJourney(
    userId: string,
    data: { title: string; category: string; description?: string },
  ) {
    return this.prisma.journey.create({
      data: {
        userId,
        title: data.title,
        slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: data.category,
        description: data.description,
      },
    });
  }

  async getJourneys(userId: string, limit: number = 20, cursor?: string) {
    const query: any = {
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { milestones: true, tasks: true } },
      },
    };
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }
    return this.prisma.journey.findMany(query);
  }

  async getJourney(userId: string, id: string) {
    const journey = await this.prisma.journey.findUnique({
      where: { id },
      include: {
        milestones: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            tasks: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!journey || journey.deletedAt) {
      throw new NotFoundException('Journey not found');
    }

    if (journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey');
    }

    // Calculate progress based on tasks
    let completedTasks = 0;
    let totalTasks = 0;
    let completedMilestones = 0;
    const totalMilestones = journey.milestones.length;

    journey.milestones.forEach((m) => {
      let mCompletedTasks = 0;
      const mTotalTasks = m.tasks.length;

      m.tasks.forEach((t) => {
        totalTasks++;
        if (t.status === 'DONE') {
          completedTasks++;
          mCompletedTasks++;
        }
      });

      if (mTotalTasks > 0 && mCompletedTasks === mTotalTasks) {
        completedMilestones++;
      }
    });

    const progress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return {
      ...journey,
      progress,
      completedTasks,
      totalTasks,
      completedMilestones,
      totalMilestones,
    };
  }

  async updateJourney(
    userId: string,
    id: string,
    data: Partial<{
      title: string;
      category: string;
      description: string;
      status: any;
    }>,
  ) {
    const journey = await this.prisma.journey.findUnique({ where: { id } });
    if (!journey || journey.deletedAt) throw new NotFoundException();
    if (journey.userId !== userId) throw new ForbiddenException();

    const updates: any = { ...data };
    if (data.title) {
      updates.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    return this.prisma.journey.update({
      where: { id },
      data: updates,
    });
  }

  async deleteJourney(userId: string, id: string) {
    const journey = await this.prisma.journey.findUnique({ where: { id } });
    if (!journey || journey.deletedAt) throw new NotFoundException();
    if (journey.userId !== userId) throw new ForbiddenException();

    return this.prisma.journey.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reorderMilestones(
    userId: string,
    journeyId: string,
    ordering: { id: string; sort_order: number }[],
  ) {
    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
    });
    if (!journey || journey.deletedAt)
      throw new NotFoundException('Journey not found');
    if (journey.userId !== userId) throw new ForbiddenException();

    const milestoneIds = ordering.map((o) => o.id);
    const milestones = await this.prisma.milestone.findMany({
      where: { id: { in: milestoneIds }, journeyId, deletedAt: null },
    });

    if (milestones.length !== milestoneIds.length) {
      throw new BadRequestException('Invalid milestone IDs provided');
    }

    return this.prisma.$transaction(
      ordering.map((order) =>
        this.prisma.milestone.update({
          where: { id: order.id },
          data: { sortOrder: order.sort_order },
        }),
      ),
    );
  }

  async getStats(userId: string, id: string) {
    const journey = await this.prisma.journey.findUnique({
      where: { id },
      include: {
        milestones: {
          where: { deletedAt: null },
          include: {
            tasks: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!journey || journey.deletedAt) {
      throw new NotFoundException('Journey not found');
    }
    if (journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey');
    }

    let completedTasks = 0;
    let totalTasks = 0;
    let completedMilestones = 0;
    const totalMilestones = journey.milestones.length;

    journey.milestones.forEach((m) => {
      let mCompletedTasks = 0;
      const mTotalTasks = m.tasks.length;

      m.tasks.forEach((t) => {
        totalTasks++;
        if (t.status === 'DONE') {
          completedTasks++;
          mCompletedTasks++;
        }
      });

      if (mTotalTasks > 0 && mCompletedTasks === mTotalTasks) {
        completedMilestones++;
      }
    });

    const progress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return {
      progress,
      completedTasks,
      totalTasks,
      completedMilestones,
      totalMilestones,
    };
  }
}
