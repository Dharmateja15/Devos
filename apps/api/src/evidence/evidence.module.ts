import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { GitHubEvidenceService } from './github-evidence.service';
import { GitHubClientAdapter } from './github-client.adapter';
import { GamificationModule } from '../gamification/gamification.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [GamificationModule, PrismaModule],
  controllers: [EvidenceController],
  providers: [EvidenceService, GitHubEvidenceService, GitHubClientAdapter],
  exports: [EvidenceService, GitHubEvidenceService, GitHubClientAdapter],
})
export class EvidenceModule {}
