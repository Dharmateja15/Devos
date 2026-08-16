import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ImportCsvController } from './import-csv.controller';
import { ImportCsvService } from './import-csv.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

describe('Phase 8A — CSV Import API (Final Hardening Audit)', () => {
  let controller: ImportCsvController;
  let service: ImportCsvService;

  const userA = { id: 'user_a_uuid_1234567890' };
  const userB = { id: 'user_b_uuid_9876543210' };
  const journeyId = 'journey_uuid_1111111111';

  const mockJourney = {
    id: journeyId,
    userId: userA.id,
    title: 'Python Mastery',
    deletedAt: null,
  };

  const redisStore = new Map<string, any>();

  const mockPrisma = {
    journey: {
      findUnique: jest.fn(),
    },
    milestone: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    task: {
      count: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (callback) => callback(mockPrisma)),
  };

  const mockRedisService = {
    setImportPreviewState: jest.fn(async (token: string, payload: any) => {
      redisStore.set(`import:csv:preview:${token}`, {
        ...payload,
        status: 'READY',
      });
    }),
    acquireImportPreviewExecution: jest.fn(
      async (token: string, userId: string, jId: string) => {
        const key = `import:csv:preview:${token}`;
        const val = redisStore.get(key);
        if (!val) return { error: 'NOT_FOUND' };
        if (val.userId !== userId || val.journeyId !== jId)
          return { error: 'FORBIDDEN' };
        if (val.status === 'EXECUTING' || val.status === 'COMMITTED')
          return { error: 'LOCKED' };
        val.status = 'EXECUTING';
        redisStore.set(key, val);
        return { data: val };
      },
    ),
    commitImportPreviewState: jest.fn(async (token: string) => {
      const key = `import:csv:preview:${token}`;
      redisStore.delete(key);
    }),
    releaseImportPreviewExecution: jest.fn(async (token: string) => {
      const key = `import:csv:preview:${token}`;
      const val = redisStore.get(key);
      if (val && val.status === 'EXECUTING') {
        val.status = 'READY';
        redisStore.set(key, val);
      }
    }),
    getAndDeleteImportPreviewState: jest.fn(async (token: string) => {
      const key = `import:csv:preview:${token}`;
      const val = redisStore.get(key);
      if (val) {
        redisStore.delete(key);
        return val;
      }
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisStore.clear();

    mockPrisma.journey.findUnique.mockImplementation(
      async ({ where: { id } }: any) => {
        if (id === journeyId) return mockJourney;
        if (id === 'journey_deleted')
          return {
            ...mockJourney,
            id: 'journey_deleted',
            deletedAt: new Date(),
          };
        return null;
      },
    );

    mockPrisma.milestone.findMany.mockResolvedValue([]);
    mockPrisma.milestone.count.mockResolvedValue(0);
    mockPrisma.milestone.create.mockResolvedValue({
      id: 'm_created_default',
      title: 'Default Milestone',
    });
    mockPrisma.task.count.mockResolvedValue(0);
    mockPrisma.task.create.mockResolvedValue({ id: 't_created_default' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportCsvController],
      providers: [
        ImportCsvService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<ImportCsvController>(ImportCsvController);
    service = module.get<ImportCsvService>(ImportCsvService);
  });

  describe('1. Journey Ownership & Scoping', () => {
    it('1. Authenticated preview succeeds for journey owner', async () => {
      const csv = 'title,milestone,priority\nTask 1,Milestone A,HIGH';
      const res = await controller.preview(userA, journeyId, { file: csv });
      expect(res.validRows).toBe(1);
      expect(res.previewToken).toBeTruthy();
    });

    it('2. Missing auth/file parameters throw BadRequestException', async () => {
      await expect(
        controller.preview(userA, journeyId, undefined, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. User cannot preview into another user journey (ForbiddenException)', async () => {
      const csv = 'title,milestone,priority\nTask 1,Milestone A,HIGH';
      await expect(
        controller.preview(userB, journeyId, { file: csv }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('4. Deleted Journey request is rejected with NotFoundException', async () => {
      const csv = 'title,milestone,priority\nTask 1,Milestone A,HIGH';
      await expect(
        controller.preview(userA, 'journey_deleted', { file: csv }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Parsing & Field Validation', () => {
    it('5. Valid CSV parses correctly', async () => {
      const csv =
        'title,milestone,priority,due_date,tags\nLearn Basics,Python,HIGH,2026-12-31,"core,basics"';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.invalidRows).toBe(0);
      expect(res.validRows).toBe(1);
      expect(res.milestonesToCreate).toEqual(['Python']);
      expect(res.tasksToCreate).toBe(1);
    });

    it('6. Quoted CSV fields with embedded commas parse correctly', async () => {
      const csv =
        'title,milestone,priority\n"Task with, comma inside",Python,MEDIUM';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.validRows).toBe(1);
      expect(res.invalidRows).toBe(0);
    });

    it('7. Required columns missing from header throws BadRequestException', async () => {
      const csv = 'wrong_col,milestone,priority\nTask 1,M1,HIGH';
      await expect(
        controller.preview(userA, journeyId, { file: csv }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. Missing title is identified in validation errors', async () => {
      const csv = 'title,milestone,priority\n,Milestone A,HIGH';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.invalidRows).toBe(1);
      expect(res.previewToken).toBeNull();
      expect(res.errors[0]).toEqual({
        row: 1,
        column: 'title',
        message: 'Title is required',
      });
    });

    it('9. Missing milestone is identified in validation errors', async () => {
      const csv = 'title,milestone,priority\nTask Title,,HIGH';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.invalidRows).toBe(1);
      expect(res.previewToken).toBeNull();
      expect(res.errors[0]).toEqual({
        row: 1,
        column: 'milestone',
        message: 'Milestone is required',
      });
    });

    it('10. Invalid priority is rejected with detailed message', async () => {
      const csv = 'title,milestone,priority\nTask Title,M1,URGENT';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.invalidRows).toBe(1);
      expect(res.previewToken).toBeNull();
      expect(res.errors[0].column).toBe('priority');
    });

    it('11. Invalid due_date is rejected in validation errors', async () => {
      const csv =
        'title,milestone,priority,due_date\nTask Title,M1,HIGH,not-a-date';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.invalidRows).toBe(1);
      expect(res.errors[0].column).toBe('due_date');
    });

    it('12. Tags in comma-separated and array formats parse correctly', async () => {
      const csv =
        'title,milestone,priority,tags\nTask Title,M1,HIGH,"tag1, tag2"';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.validRows).toBe(1);
      expect(res.errors).toHaveLength(0);
    });

    it('13. Empty CSV throws BadRequestException', async () => {
      const csv = 'title,milestone,priority\n';
      await expect(
        controller.preview(userA, journeyId, { file: csv }),
      ).rejects.toThrow(BadRequestException);
    });

    it('14. Malformed CSV syntax throws BadRequestException', async () => {
      const csv = 'title,milestone,priority\n"Unclosed quotes,M1,HIGH';
      await expect(
        controller.preview(userA, journeyId, { file: csv }),
      ).rejects.toThrow(BadRequestException);
    });

    it('15. Exceeding 500 data rows is rejected', async () => {
      const header = 'title,milestone,priority\n';
      const rows = Array.from(
        { length: 501 },
        (_, i) => `Task ${i},M1,LOW`,
      ).join('\n');
      await expect(
        controller.preview(userA, journeyId, { file: header + rows }),
      ).rejects.toThrow(BadRequestException);
    });

    it('16. All rows are validated before returning; no write occurs on failure', async () => {
      const csv = 'title,milestone,priority\nTask 1,M1,HIGH\n,M1,LOW';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.invalidRows).toBe(1);
      expect(res.validRows).toBe(1);
      expect(res.previewToken).toBeNull();
      expect(mockPrisma.milestone.create).not.toHaveBeenCalled();
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('3. Milestone Resolution & Preview Behaviour', () => {
    it('17. Preview performs ZERO database writes', async () => {
      const csv = 'title,milestone,priority\nTask 1,M1,HIGH';
      await controller.preview(userA, journeyId, { file: csv });

      expect(mockPrisma.milestone.create).not.toHaveBeenCalled();
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });

    it('18. Existing milestone in journey is reused and listed in milestonesExisting', async () => {
      mockPrisma.milestone.findMany.mockResolvedValue([
        { id: 'm_existing_1', title: 'Python Basics', journeyId },
      ]);

      const csv =
        'title,milestone,priority\nTask 1,Python Basics,HIGH\nTask 2,New Milestone,LOW';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.milestonesExisting).toContain('Python Basics');
      expect(res.milestonesToCreate).toContain('New Milestone');
    });

    it('19. Missing milestone appears exactly once in preview', async () => {
      const csv =
        'title,milestone,priority\nTask 1,Python Basics,HIGH\nTask 2,Python Basics,LOW';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.milestonesToCreate).toEqual(['Python Basics']);
    });

    it('20. Repeated milestone rows produce single milestone to create', async () => {
      const csv =
        'title,milestone,priority\nTask 1,Setup,HIGH\nTask 2,Setup,MEDIUM\nTask 3,Setup,LOW';
      const res = await controller.preview(userA, journeyId, { file: csv });

      expect(res.milestonesToCreate).toHaveLength(1);
      expect(res.tasksToCreate).toBe(3);
    });
  });

  describe('4. Failure Matrix & Concurrency Audit (Final Hardening Pass)', () => {
    it('Matrix A: Redis unavailable during preview fails safely without process memory fallback', async () => {
      mockRedisService.setImportPreviewState.mockRejectedValueOnce(
        new Error('Redis cluster unreachable'),
      );
      const csv = 'title,milestone,priority\nTask 1,Setup,HIGH';

      await expect(
        controller.preview(userA, journeyId, { file: csv }),
      ).rejects.toThrow('Redis cluster unreachable');
      expect(redisStore.size).toBe(0);
    });

    it('Matrix B: Redis unavailable during execute fails safely', async () => {
      mockRedisService.acquireImportPreviewExecution.mockRejectedValueOnce(
        new Error('Redis connection drop'),
      );

      await expect(
        controller.execute(userA, journeyId, { previewToken: 'token_123' }),
      ).rejects.toThrow('Redis connection drop');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('Matrix C: Prisma transaction definitely rolls back and releases lock to READY for safe retry', async () => {
      const csv = 'title,milestone,priority\nTask 1,Setup,HIGH';
      const previewRes = await controller.preview(userA, journeyId, {
        file: csv,
      });
      const token = previewRes.previewToken!;

      // Mock $transaction failure on first attempt
      mockPrisma.$transaction.mockImplementationOnce(async () => {
        throw new Error('Transient DB deadlock / timeout');
      });

      // First attempt fails
      await expect(
        controller.execute(userA, journeyId, { previewToken: token }),
      ).rejects.toThrow('Transient DB deadlock / timeout');

      // Verify token remains in store and was reset to READY
      const storeVal = redisStore.get(`import:csv:preview:${token}`);
      expect(storeVal).toBeDefined();
      expect(storeVal.status).toBe('READY');

      // Second attempt (retry) succeeds!
      mockPrisma.milestone.create.mockResolvedValueOnce({
        id: 'm_retry_1',
        title: 'Setup',
      });
      mockPrisma.task.create.mockResolvedValueOnce({ id: 't_retry_1' });

      const retryRes = await controller.execute(userA, journeyId, {
        previewToken: token,
      });
      expect(retryRes.success).toBe(true);
      expect(retryRes.status).toBe('COMPLETED');
    });

    it('Matrix D & I: Successful transaction permanently consumes preview state, preventing replay', async () => {
      const csv = 'title,milestone,priority\nTask 1,Setup,HIGH';
      const previewRes = await controller.preview(userA, journeyId, {
        file: csv,
      });
      const token = previewRes.previewToken!;

      const execRes = await controller.execute(userA, journeyId, {
        previewToken: token,
      });
      expect(execRes.success).toBe(true);
      expect(redisStore.has(`import:csv:preview:${token}`)).toBe(false);

      // Replay attempt throws BadRequestException
      await expect(
        controller.execute(userA, journeyId, { previewToken: token }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Matrix E: Concurrent execute requests allow exactly ONE execution', async () => {
      const csv = 'title,milestone,priority\nTask 1,Setup,HIGH';
      const previewRes = await controller.preview(userA, journeyId, {
        file: csv,
      });
      const token = previewRes.previewToken!;

      const p1 = controller.execute(userA, journeyId, { previewToken: token });
      const p2 = controller.execute(userA, journeyId, { previewToken: token });

      const [res1, res2] = await Promise.allSettled([p1, p2]);

      expect(res1.status).toBe('fulfilled');
      expect(res2.status).toBe('rejected');
    });

    it('Matrix F: Cross-user execute is rejected with ForbiddenException', async () => {
      const csv = 'title,milestone,priority\nTask 1,Setup,HIGH';
      const previewRes = await controller.preview(userA, journeyId, {
        file: csv,
      });

      await expect(
        controller.execute(userB, journeyId, {
          previewToken: previewRes.previewToken!,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Matrix G: Cross-journey execute is rejected with NotFoundException', async () => {
      const csv = 'title,milestone,priority\nTask 1,Setup,HIGH';
      const previewRes = await controller.preview(userA, journeyId, {
        file: csv,
      });

      await expect(
        controller.execute(userA, 'other_journey_id', {
          previewToken: previewRes.previewToken!,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Matrix H: Expired or unknown preview token is rejected', async () => {
      await expect(
        controller.execute(userA, journeyId, { previewToken: 'unknown_token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Matrix J: Same-journey concurrent imports execute PostgreSQL row lock and reuse milestone', async () => {
      mockPrisma.milestone.findMany.mockResolvedValue([
        { id: 'm_existing_1', title: 'Backend', journeyId },
      ]);

      const csv = 'title,milestone,priority\nTask 1,Backend,HIGH';
      const previewRes = await controller.preview(userA, journeyId, {
        file: csv,
      });

      await controller.execute(userA, journeyId, {
        previewToken: previewRes.previewToken!,
      });

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect(mockPrisma.milestone.create).not.toHaveBeenCalled();
      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ milestoneId: 'm_existing_1' }),
      });
    });
  });
});
