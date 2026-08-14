import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { JourneysModule } from './journeys/journeys.module';
import { EvidenceModule } from './evidence/evidence.module';
import { LearningModule } from './learning/learning.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { RoadmapModule } from './roadmap/roadmap.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    JourneysModule,
    EvidenceModule,
    LearningModule,
    AiGatewayModule,
    RoadmapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
