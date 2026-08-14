import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapReconciliationService } from './roadmap-reconciliation.service';
import { TasksService } from '../journeys/tasks.service';
import { MappingStatus, TaskPriority, RoadmapStatus, RoadmapPriority } from '@prisma/client';

export interface DailyFocusItem {
  taskId?: string;
  nodeId: string;
  snapshotId: string;
  roadmapId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  roadmapPriority: RoadmapPriority;
  estimatedHours: number;
  whyReason: string;
}

export interface MaterializeOptions {
  maxTasks?: number;
  journeyId?: string;
  milestoneId?: string;
}

@Injectable()
export class RoadmapMaterializationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationService: RoadmapReconciliationService,
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Materializes actionable roadmap nodes into DevOS Tasks for a given snapshot/roadmap.
   * Strictly requires roadmap status === ACTIVE. Paused/Archived roadmaps cannot materialize tasks.
   */
  async materializeActionableTasks(userId: string, roadmapId: string, options?: MaterializeOptions) {
    const roadmap = await this.prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          take: 1,
          include: {
            nodes: {
              orderBy: { sortOrder: 'asc' },
              include: {
                mappings: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!roadmap || roadmap.deletedAt !== null) {
      throw new NotFoundException(`Roadmap with ID ${roadmapId} not found.`);
    }

    if (roadmap.userId !== userId) {
      throw new ForbiddenException('You do not have permission to materialize this roadmap.');
    }

    if (roadmap.status !== RoadmapStatus.ACTIVE) {
      throw new BadRequestException(`Cannot materialize tasks for roadmap in state ${roadmap.status}. Resume roadmap to active status.`);
    }

    const latestSnapshot = roadmap.snapshots[0];
    if (!latestSnapshot) {
      return [];
    }

    const metadata = (roadmap.metadata as any) || {};
    const maxTasks = options?.maxTasks || metadata.maxTasksWindow || 5;

    // Determine target Journey and Milestone
    let journeyId = options?.journeyId;
    let milestoneId = options?.milestoneId;

    if (!journeyId || !milestoneId) {
      const activeJourney = await this.prisma.journey.findFirst({
        where: { userId, deletedAt: null },
        include: {
          milestones: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!activeJourney || activeJourney.milestones.length === 0) {
        throw new BadRequestException('An active Journey with at least one Milestone is required to materialize roadmap tasks.');
      }

      journeyId = activeJourney.id;
      milestoneId = activeJourney.milestones[0].id;
    }

    // Get current position & actionable nodes
    const position = await this.reconciliationService.calculateCurrentPosition(userId, latestSnapshot.id);
    const actionableNodes = position.nextActionableNodes.slice(0, maxTasks);

    const materializedTasks = [];

    for (const node of actionableNodes) {
      const mapping = node.mappings[0];

      // Skip if already mapped to task/project or completed/skipped
      if (mapping && (mapping.taskId || mapping.projectId || mapping.mappingStatus === MappingStatus.COMPLETED || mapping.mappingStatus === MappingStatus.SKIPPED)) {
        if (mapping.taskId) {
          const existingTask = await this.prisma.task.findUnique({ where: { id: mapping.taskId } });
          if (existingTask) {
            materializedTasks.push(existingTask);
            continue;
          }
        }
        continue;
      }

      // Cross-Roadmap Deduplication: Check if equivalent task already exists in DevOS
      const existingTaskMatch = await this.prisma.task.findFirst({
        where: {
          journey: { userId },
          deletedAt: null,
          title: { equals: node.title, mode: 'insensitive' },
        },
      });

      if (existingTaskMatch) {
        if (mapping) {
          await this.prisma.roadmapMapping.update({
            where: { id: mapping.id },
            data: { taskId: existingTaskMatch.id },
          });
        }
        materializedTasks.push(existingTaskMatch);
        continue;
      }

      // Materialize new DevOS Task via TasksService
      const newTask = await this.tasksService.createTask(userId, milestoneId!, {
        title: node.title,
        description: node.description || `Materialized from roadmap ${roadmap.title}`,
      });

      if (mapping) {
        await this.prisma.roadmapMapping.update({
          where: { id: mapping.id },
          data: {
            taskId: newTask.id,
            mappingStatus: MappingStatus.IN_PROGRESS,
          },
        });
      }

      materializedTasks.push(newTask);
    }

    return materializedTasks;
  }

  /**
   * Generates Daily Focus recommendations across ACTIVE user roadmaps.
   * Paused, Completed, or Archived roadmaps are strictly excluded.
   */
  async getDailyFocus(userId: string, availableHours: number = 2.5): Promise<DailyFocusItem[]> {
    const activeRoadmaps = await this.prisma.roadmap.findMany({
      where: {
        userId,
        status: RoadmapStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        snapshots: {
          orderBy: { importedAt: 'desc' },
          take: 1,
          include: {
            nodes: {
              orderBy: { sortOrder: 'asc' },
              include: {
                mappings: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (activeRoadmaps.length === 0) {
      return [];
    }

    const candidates: DailyFocusItem[] = [];

    for (const roadmap of activeRoadmaps) {
      const latestSnapshot = roadmap.snapshots[0];
      if (!latestSnapshot) continue;

      const roadmapPriority = roadmap.priority;
      const position = await this.reconciliationService.calculateCurrentPosition(userId, latestSnapshot.id);

      for (const node of position.nextActionableNodes) {
        const mapping = node.mappings[0];

        if (mapping && (mapping.mappingStatus === MappingStatus.COMPLETED || mapping.mappingStatus === MappingStatus.SKIPPED)) {
          continue;
        }

        let priority: TaskPriority = TaskPriority.MEDIUM;
        if (roadmapPriority === RoadmapPriority.PRIMARY) priority = TaskPriority.HIGH;
        else if (roadmapPriority === RoadmapPriority.LOW) priority = TaskPriority.LOW;

        const whyReason = `Prioritized for goal "${roadmap.title}" because this is the next actionable node in your ${roadmapPriority} roadmap "${roadmap.title}" and prerequisites are satisfied.`;

        candidates.push({
          taskId: mapping?.taskId || undefined,
          nodeId: node.id,
          snapshotId: latestSnapshot.id,
          roadmapId: roadmap.id,
          title: node.title,
          description: node.description || undefined,
          priority,
          roadmapPriority,
          estimatedHours: 0.5,
          whyReason,
        });
      }
    }

    // Rank candidates by roadmap priority (PRIMARY > SECONDARY > LOW)
    candidates.sort((a, b) => {
      const weight = { PRIMARY: 3, SECONDARY: 2, LOW: 1 };
      return weight[b.roadmapPriority] - weight[a.roadmapPriority];
    });

    // Fit within available hours window
    let allocated = 0;
    const focusItems: DailyFocusItem[] = [];

    for (const cand of candidates) {
      if (allocated + cand.estimatedHours <= availableHours) {
        focusItems.push(cand);
        allocated += cand.estimatedHours;
      }
    }

    return focusItems;
  }
}
