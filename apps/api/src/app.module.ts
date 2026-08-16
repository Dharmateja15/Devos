import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { JourneysModule } from './journeys/journeys.module';
import { EvidenceModule } from './evidence/evidence.module';
import { LearningModule } from './learning/learning.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { GamificationModule } from './gamification/gamification.module';
import { ProfileModule } from './profile/profile.module';
import { RedisModule } from './common/redis.module';
import { SentryExceptionFilter } from './common/sentry-exception.filter';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    PrismaModule,
    JourneysModule,
    EvidenceModule,
    LearningModule,
    AiGatewayModule,
    RoadmapModule,
    GamificationModule,
    ProfileModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: SentryExceptionFilter,
    },
  ],
})
export class AppModule {}
