import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';
import { AchievementsService } from './achievements.service';

@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly achievementsService: AchievementsService,
  ) {}

  @Get('xp')
  async getXpSummary(@CurrentUser() user: any) {
    return this.gamificationService.getXpSummary(user.id);
  }

  @Get('achievements')
  async getAchievementsCatalogue(@CurrentUser() user: any) {
    return this.achievementsService.getUserAchievementCatalogue(user.id);
  }
}
