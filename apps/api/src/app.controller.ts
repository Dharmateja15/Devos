import {
  Controller,
  Get,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './common/redis.service';

@Controller('health')
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('liveness')
  getLivenessExplicit() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  async getReadiness() {
    let dbStatus = 'down';
    let redisStatus = 'down';

    // 1. Check Database Connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch (err: any) {
      this.logger.error(`Readiness Check - Database failure: ${err.message}`);
    }

    // 2. Check Redis Connectivity
    try {
      const client = this.redisService.getClient();
      if (
        client &&
        (client.status === 'ready' || client.status === 'connect')
      ) {
        const pingRes = await client.ping();
        if (pingRes === 'PONG') {
          redisStatus = 'up';
        }
      } else {
        redisStatus = 'disabled';
      }
    } catch (err: any) {
      this.logger.warn(`Readiness Check - Redis unavailable: ${err.message}`);
      redisStatus = 'down';
    }

    const isHealthy = dbStatus === 'up';

    const healthDetails = {
      status: isHealthy ? 'ok' : 'degraded',
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(healthDetails);
    }

    return healthDetails;
  }
}
