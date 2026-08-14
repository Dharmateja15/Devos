import { Module } from '@nestjs/common';
import { JourneysController } from './journeys.controller';
import { MilestonesController } from './milestones.controller';
import { TasksController } from './tasks.controller';
import { JourneysService } from './journeys.service';
import { MilestonesService } from './milestones.service';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [JourneysController, MilestonesController, TasksController],
  providers: [JourneysService, MilestonesService, TasksService, PrismaService],
  exports: [JourneysService, MilestonesService, TasksService],
})
export class JourneysModule {}
