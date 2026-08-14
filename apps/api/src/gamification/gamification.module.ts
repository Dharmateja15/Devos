import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { AchievementsService } from './achievements.service';

@Module({
  providers: [GamificationService, AchievementsService],
  exports: [GamificationService, AchievementsService],
})
export class GamificationModule {}
