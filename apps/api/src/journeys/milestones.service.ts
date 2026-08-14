import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyJourneyOwnership(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findUnique({ where: { id: journeyId } });
    if (!journey || journey.deletedAt) throw new NotFoundException('Journey not found');
    if (journey.userId !== userId) throw new ForbiddenException('You do not own this journey');
    return journey;
  }

  async createMilestone(userId: string, journeyId: string, data: { title: string, description?: string }) {
    await this.verifyJourneyOwnership(userId, journeyId);

    const count = await this.prisma.milestone.count({ where: { journeyId, deletedAt: null } });

    return this.prisma.milestone.create({
      data: {
        journeyId,
        title: data.title,
        description: data.description,
        sortOrder: count,
      },
    });
  }

  async getMilestones(userId: string, journeyId: string, limit: number = 20, cursor?: string) {
    await this.verifyJourneyOwnership(userId, journeyId);

    const query: any = {
      where: { journeyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      take: limit,
      include: {
        tasks: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        }
      }
    };
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }
    return this.prisma.milestone.findMany(query);
  }

  async getMilestone(userId: string, id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: { journey: true, tasks: { where: { deletedAt: null } } }
    });
    if (!milestone || milestone.deletedAt || milestone.journey.deletedAt) throw new NotFoundException('Milestone not found');
    if (milestone.journey.userId !== userId) throw new ForbiddenException();

    let completedTasks = 0;
    milestone.tasks.forEach(t => {
      if (t.status === 'DONE') completedTasks++;
    });
    const progress = milestone.tasks.length === 0 ? 0 : Math.round((completedTasks / milestone.tasks.length) * 100);

    return { ...milestone, progress, completedTasks, totalTasks: milestone.tasks.length };
  }

  async updateMilestone(userId: string, id: string, data: Partial<{ title: string, description: string, status: any, sortOrder: number }>) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id }, include: { journey: true } });
    if (!milestone || milestone.deletedAt || milestone.journey.deletedAt) throw new NotFoundException();
    if (milestone.journey.userId !== userId) throw new ForbiddenException();

    return this.prisma.milestone.update({
      where: { id },
      data,
    });
  }

  async deleteMilestone(userId: string, id: string) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id }, include: { journey: true } });
    if (!milestone || milestone.deletedAt || milestone.journey.deletedAt) throw new NotFoundException();
    if (milestone.journey.userId !== userId) throw new ForbiddenException();

    return this.prisma.milestone.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reorderMilestones(userId: string, journeyId: string, ordering: { id: string, sort_order: number }[]) {
    await this.verifyJourneyOwnership(userId, journeyId);

    const milestoneIds = ordering.map(o => o.id);
    const milestones = await this.prisma.milestone.findMany({
      where: { id: { in: milestoneIds }, journeyId, deletedAt: null }
    });
    
    if (milestones.length !== milestoneIds.length) {
      throw new BadRequestException('Invalid milestone IDs provided');
    }

    return this.prisma.$transaction(
      ordering.map(order => 
        this.prisma.milestone.update({
          where: { id: order.id },
          data: { sortOrder: order.sort_order }
        })
      )
    );
  }

  async reorderTasks(userId: string, milestoneId: string, ordering: { id: string, sort_order: number }[]) {

    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId }, include: { journey: true } });
    if (!milestone || milestone.deletedAt || milestone.journey.deletedAt) throw new NotFoundException('Milestone not found');
    if (milestone.journey.userId !== userId) throw new ForbiddenException();

    const taskIds = ordering.map(o => o.id);
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds }, milestoneId, deletedAt: null }
    });
    
    if (tasks.length !== taskIds.length) {
      throw new BadRequestException('Invalid task IDs provided');
    }

    return this.prisma.$transaction(
      ordering.map(order => 
        this.prisma.task.update({
          where: { id: order.id },
          data: { sortOrder: order.sort_order }
        })
      )
    );
  }
}
