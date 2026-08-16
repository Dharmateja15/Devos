import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './common/redis.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('AppController Health & Readiness', () => {
  let appController: AppController;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    mockRedis = {
      getClient: jest.fn().mockReturnValue({
        status: 'ready',
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  describe('Liveness Endpoints', () => {
    it('GET /health should return liveness status ok', () => {
      const res = appController.getLiveness();
      expect(res.status).toBe('ok');
      expect(res.timestamp).toBeDefined();
    });

    it('GET /health/liveness should return liveness status ok', () => {
      const res = appController.getLivenessExplicit();
      expect(res.status).toBe('ok');
      expect(res.timestamp).toBeDefined();
    });
  });

  describe('Readiness Endpoint', () => {
    it('GET /health/readiness should return up status when DB and Redis are healthy', async () => {
      const res = await appController.getReadiness();
      expect(res.status).toBe('ok');
      expect(res.dependencies.database).toBe('up');
      expect(res.dependencies.redis).toBe('up');
    });

    it('GET /health/readiness should throw ServiceUnavailableException if DB fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(
        new Error('DB Connection Refused'),
      );

      await expect(appController.getReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('GET /health/readiness should remain ok if Redis is offline/disabled', async () => {
      mockRedis.getClient.mockReturnValue(null);

      const res = await appController.getReadiness();
      expect(res.status).toBe('ok');
      expect(res.dependencies.database).toBe('up');
      expect(res.dependencies.redis).toBe('disabled');
    });
  });
});
