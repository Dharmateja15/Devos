import { Module } from '@nestjs/common';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapReconciliationService } from './roadmap-reconciliation.service';
import { RoadmapMaterializationService } from './roadmap-materialization.service';
import { RoadmapIntelligenceService } from './roadmap-intelligence.service';
import { ProjectGapService } from './project-gap.service';
import { RoadmapShAdapter } from './adapters/roadmapsh.adapter';
import { CsvAdapter } from './adapters/csv.adapter';
import { MarkdownAdapter } from './adapters/markdown.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { JourneysModule } from '../journeys/journeys.module';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [PrismaModule, JourneysModule, LearningModule],
  controllers: [RoadmapController],
  providers: [
    RoadmapService,
    RoadmapReconciliationService,
    RoadmapMaterializationService,
    RoadmapIntelligenceService,
    ProjectGapService,
    RoadmapShAdapter,
    CsvAdapter,
    MarkdownAdapter,
  ],
  exports: [
    RoadmapService,
    RoadmapReconciliationService,
    RoadmapMaterializationService,
    RoadmapIntelligenceService,
    ProjectGapService,
  ],
})
export class RoadmapModule {}
