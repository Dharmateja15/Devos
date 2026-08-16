import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import { TaskPriority } from '@prisma/client';
import * as Papa from 'papaparse';
import { randomBytes } from 'crypto';

export interface CsvRowError {
  row: number;
  column: string;
  message: string;
}

export interface CsvPreviewResponse {
  previewToken: string | null;
  journeyId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  milestonesExisting: string[];
  milestonesToCreate: string[];
  tasksToCreate: number;
  errors: CsvRowError[];
}

export interface CsvExecuteResponse {
  success: boolean;
  status: string;
  tasksCreated: number;
  milestonesCreated: number;
}

@Injectable()
export class ImportCsvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private async verifyJourneyOwnership(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
    });
    if (!journey || journey.deletedAt) {
      throw new NotFoundException('Journey not found');
    }
    if (journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey');
    }
    return journey;
  }

  async previewCsv(
    userId: string,
    journeyId: string,
    csvContent: string,
  ): Promise<CsvPreviewResponse> {
    await this.verifyJourneyOwnership(userId, journeyId);

    if (!csvContent || !csvContent.trim()) {
      throw new BadRequestException('CSV content is required');
    }

    const parseResult = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      const fatalError = parseResult.errors.find(
        (e) =>
          (e.code as string) === 'Quotes' ||
          e.code === 'InvalidQuotes' ||
          e.code === 'MissingQuotes' ||
          e.type === 'Quotes',
      );
      if (fatalError || parseResult.data.length === 0) {
        throw new BadRequestException('Malformed CSV file');
      }
    }

    const headers = parseResult.meta.fields || [];
    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
    const requiredColumns = ['title', 'milestone', 'priority'];
    const missingColumns = requiredColumns.filter(
      (col) => !normalizedHeaders.includes(col),
    );

    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Missing required CSV column headers: ${missingColumns.join(', ')}`,
      );
    }

    const rows = parseResult.data || [];
    const totalRows = rows.length;

    if (totalRows === 0) {
      throw new BadRequestException(
        'CSV file is empty or contains no data rows',
      );
    }

    if (totalRows > 500) {
      throw new BadRequestException(
        'CSV exceeds maximum limit of 500 data rows',
      );
    }

    const errors: CsvRowError[] = [];
    const validTasks: Array<{
      title: string;
      milestone: string;
      priority: TaskPriority;
      dueDate: string | null;
      tags: string[];
    }> = [];

    // Helper to extract row field case-insensitively
    const getFieldValue = (
      row: Record<string, string>,
      targetKey: string,
    ): string => {
      const foundKey = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === targetKey,
      );
      return foundKey ? row[foundKey] : '';
    };

    rows.forEach((row, index) => {
      const rowNum = index + 1;
      const titleRaw = getFieldValue(row, 'title');
      const milestoneRaw = getFieldValue(row, 'milestone');
      const priorityRaw = getFieldValue(row, 'priority');
      const dueDateRaw = getFieldValue(row, 'due_date');
      const tagsRaw = getFieldValue(row, 'tags');

      const title = titleRaw ? titleRaw.trim() : '';
      if (!title) {
        errors.push({
          row: rowNum,
          column: 'title',
          message: 'Title is required',
        });
      }

      const milestone = milestoneRaw ? milestoneRaw.trim() : '';
      if (!milestone) {
        errors.push({
          row: rowNum,
          column: 'milestone',
          message: 'Milestone is required',
        });
      }

      const priorityUpper = priorityRaw ? priorityRaw.trim().toUpperCase() : '';
      const validPriorities: string[] = Object.values(TaskPriority);
      if (!priorityUpper || !validPriorities.includes(priorityUpper)) {
        errors.push({
          row: rowNum,
          column: 'priority',
          message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
        });
      }

      let parsedDueDate: string | null = null;
      if (dueDateRaw && dueDateRaw.trim()) {
        const d = new Date(dueDateRaw.trim());
        if (isNaN(d.getTime())) {
          errors.push({
            row: rowNum,
            column: 'due_date',
            message: 'Invalid due_date format',
          });
        } else {
          parsedDueDate = d.toISOString();
        }
      }

      let parsedTags: string[] = [];
      if (tagsRaw && tagsRaw.trim()) {
        const trimmedTags = tagsRaw.trim();
        if (trimmedTags.startsWith('[') && trimmedTags.endsWith(']')) {
          try {
            const arr = JSON.parse(trimmedTags);
            if (Array.isArray(arr)) {
              parsedTags = arr
                .map((t: any) => String(t).trim())
                .filter(Boolean);
            } else {
              parsedTags = [trimmedTags];
            }
          } catch {
            parsedTags = trimmedTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } else {
          parsedTags = trimmedTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        }
      }

      if (
        title &&
        milestone &&
        validPriorities.includes(priorityUpper) &&
        (!dueDateRaw || parsedDueDate !== null)
      ) {
        validTasks.push({
          title,
          milestone,
          priority: priorityUpper as TaskPriority,
          dueDate: parsedDueDate,
          tags: parsedTags,
        });
      }
    });

    if (errors.length > 0) {
      return {
        previewToken: null,
        journeyId,
        totalRows,
        validRows: totalRows - errors.length,
        invalidRows: errors.length,
        milestonesExisting: [],
        milestonesToCreate: [],
        tasksToCreate: 0,
        errors,
      };
    }

    // Determine milestones existing vs milestones to create
    const existingMilestones = await this.prisma.milestone.findMany({
      where: { journeyId, deletedAt: null },
    });
    const existingSet = new Set(
      existingMilestones.map((m) => m.title.trim().toLowerCase()),
    );

    const csvMilestonesMap = new Map<string, string>(); // normalized -> preserved casing
    validTasks.forEach((t) => {
      const norm = t.milestone.toLowerCase();
      if (!csvMilestonesMap.has(norm)) {
        csvMilestonesMap.set(norm, t.milestone);
      }
    });

    const milestonesExisting: string[] = [];
    const milestonesToCreate: string[] = [];

    csvMilestonesMap.forEach((originalName, normName) => {
      if (existingSet.has(normName)) {
        milestonesExisting.push(originalName);
      } else {
        milestonesToCreate.push(originalName);
      }
    });

    const previewToken = randomBytes(32).toString('hex');
    const previewStatePayload = {
      userId,
      journeyId,
      milestonesToCreate,
      tasks: validTasks,
    };

    // Store short-lived state in Redis (15-min TTL)
    await this.redisService.setImportPreviewState(
      previewToken,
      previewStatePayload,
      900,
    );

    return {
      previewToken,
      journeyId,
      totalRows,
      validRows: totalRows,
      invalidRows: 0,
      milestonesExisting,
      milestonesToCreate,
      tasksToCreate: validTasks.length,
      errors: [],
    };
  }

  async executeCsv(
    userId: string,
    journeyId: string,
    previewToken: string,
  ): Promise<CsvExecuteResponse> {
    await this.verifyJourneyOwnership(userId, journeyId);

    if (
      !previewToken ||
      typeof previewToken !== 'string' ||
      !previewToken.trim()
    ) {
      throw new BadRequestException('previewToken is required');
    }

    const token = previewToken.trim();

    const acquisition = await this.redisService.acquireImportPreviewExecution(
      token,
      userId,
      journeyId,
    );

    if (acquisition.error === 'NOT_FOUND') {
      throw new BadRequestException(
        'Invalid, expired, or previously executed preview token',
      );
    }

    if (acquisition.error === 'FORBIDDEN') {
      throw new ForbiddenException(
        'Preview token does not belong to this user or journey',
      );
    }

    if (acquisition.error === 'LOCKED') {
      throw new BadRequestException(
        'Import preview is currently executing or has already been committed',
      );
    }

    const previewState = acquisition.data;

    let transactionCommitted = false;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Lock parent Journey record in Postgres to serialize concurrent import executions on the same journey
        try {
          await tx.$executeRaw`SELECT id FROM "journey"."journeys" WHERE id = ${journeyId}::uuid FOR UPDATE;`;
        } catch {
          // Fallback if DB mock / non-postgres in test environment
        }

        const currentMilestones = await tx.milestone.findMany({
          where: { journeyId, deletedAt: null },
        });

        const milestoneMap = new Map<string, string>(); // normalized title -> milestoneId
        currentMilestones.forEach((m) => {
          milestoneMap.set(m.title.trim().toLowerCase(), m.id);
        });

        let milestoneSortOrder = await tx.milestone.count({
          where: { journeyId, deletedAt: null },
        });
        let milestonesCreated = 0;

        for (const mName of previewState.milestonesToCreate || []) {
          const norm = mName.trim().toLowerCase();
          if (!milestoneMap.has(norm)) {
            const created = await tx.milestone.create({
              data: {
                journeyId,
                title: mName.trim(),
                sortOrder: milestoneSortOrder++,
              },
            });
            if (created && created.id) {
              milestoneMap.set(norm, created.id);
            }
            milestonesCreated++;
          }
        }

        let tasksCreated = 0;
        const taskSortOrderMap = new Map<string, number>();

        for (const task of previewState.tasks || []) {
          const normM = task.milestone.trim().toLowerCase();
          const milestoneId = milestoneMap.get(normM);
          if (!milestoneId) {
            throw new BadRequestException(
              `Milestone resolution failed for "${task.milestone}"`,
            );
          }

          if (!taskSortOrderMap.has(milestoneId)) {
            const initialCount = await tx.task.count({
              where: { milestoneId, deletedAt: null },
            });
            taskSortOrderMap.set(milestoneId, initialCount);
          }
          const currentSortOrder = taskSortOrderMap.get(milestoneId)!;
          taskSortOrderMap.set(milestoneId, currentSortOrder + 1);

          await tx.task.create({
            data: {
              journeyId,
              milestoneId,
              title: task.title,
              priority: task.priority,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              tags: task.tags || [],
              status: 'TODO',
              sortOrder: currentSortOrder,
            },
          });
          tasksCreated++;
        }

        return { tasksCreated, milestonesCreated };
      });

      transactionCommitted = true;

      // Commit preview state upon successful transaction commit
      try {
        await this.redisService.commitImportPreviewState(token);
      } catch {}

      return {
        success: true,
        status: 'COMPLETED',
        tasksCreated: result.tasksCreated,
        milestonesCreated: result.milestonesCreated,
      };
    } catch (err) {
      if (!transactionCommitted) {
        // Transaction failed/rolled back: release preview state back to READY for safe retry
        try {
          await this.redisService.releaseImportPreviewExecution(token);
        } catch {}
      } else {
        // Transaction committed: ensure token is deleted/committed and NEVER reset to READY
        try {
          await this.redisService.commitImportPreviewState(token);
        } catch {}
      }
      throw err;
    }
  }
}
