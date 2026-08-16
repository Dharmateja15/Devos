import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { AchievementsService } from './achievements.service';
import { GamificationController } from './gamification.controller';

@Module({
  controllers: [GamificationController],
  providers: [GamificationService, AchievementsService],
  exports: [GamificationService, AchievementsService],
})
export class GamificationModule {}
