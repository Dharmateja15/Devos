import { Controller, Post, Param, Body, Get, Req } from '@nestjs/common';
import { LearningService } from './learning.service';
import type { MasteryCheckOptions, UserIntent } from './learning.service';
import {
  RecommendationService,
  Recommendation,
} from './recommendation/recommendation.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { RecommendationSuppressionService } from './recommendation-suppression.service';

@Controller('api/v1/learning')
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly recommendationService: RecommendationService,
    private readonly conflictResolutionService: ConflictResolutionService,
    private readonly suppressionService: RecommendationSuppressionService,
  ) {}

  @Get('recommendations')
  async getRecommendations(@Req() req: any): Promise<Recommendation[]> {
    const userId = req?.user?.id || 'default-user-id';
    return this.recommendationService.getRecommendations(userId);
  }

  // --- SUB-BLOCK 6D ENDPOINTS ---

  @Get('conflicts')
  async getConflicts(@Req() req: any) {
    const userId = req?.user?.id || 'default-user-id';
    return this.conflictResolutionService.getConflicts(userId);
  }

  @Get('recommendation-adaptation')
  async getRecommendationAdaptation(@Req() req: any) {
    const userId = req?.user?.id || 'default-user-id';
    return this.suppressionService.getSuppressionStatus(userId);
  }

  @Post('concept/:conceptId/self-report')
  async selfReportConcept(
    @Param('conceptId') conceptId: string,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.learningService.selfReportConcept(userId, conceptId);
  }

  @Post('concept/:conceptId/evaluate-task')
  async evaluateTaskEvidence(
    @Param('conceptId') conceptId: string,
    @Body('taskId') taskId: string,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.learningService.evaluateTaskEvidence(userId, conceptId, taskId);
  }

  @Post('concept/:conceptId/mastery-check')
  async submitMasteryCheck(
    @Param('conceptId') conceptId: string,
    @Body() options: MasteryCheckOptions,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.learningService.submitMasteryCheck(userId, conceptId, options);
  }

  @Post('concept/:conceptId/intent')
  async setUserIntent(
    @Param('conceptId') conceptId: string,
    @Body('intent') intent: UserIntent,
    @Body('date') dateString: string,
    @Req() req: any,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    const date = dateString ? new Date(dateString) : undefined;
    return this.learningService.setUserIntent(userId, conceptId, intent, date);
  }
}
