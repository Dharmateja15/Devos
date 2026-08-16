import { Module } from '@nestjs/common';
import { JourneysController } from './journeys.controller';
import { MilestonesController } from './milestones.controller';
import { TasksController } from './tasks.controller';
import { ImportCsvController } from './import-csv.controller';
import { JourneysService } from './journeys.service';
import { MilestonesService } from './milestones.service';
import { TasksService } from './tasks.service';
import { ImportCsvService } from './import-csv.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [
    JourneysController,
    MilestonesController,
    TasksController,
    ImportCsvController,
  ],
  providers: [
    JourneysService,
    MilestonesService,
    TasksService,
    ImportCsvService,
    PrismaService,
  ],
  exports: [JourneysService, MilestonesService, TasksService, ImportCsvService],
})
export class JourneysModule {}
