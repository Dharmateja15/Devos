import { Controller, Post, Get, Patch, Delete, Body, Param, Req, Query } from '@nestjs/common';
import { RoadmapService } from './roadmap.service';
import { RoadmapReconciliationService } from './roadmap-reconciliation.service';
import { RoadmapMaterializationService } from './roadmap-materialization.service';
import { RoadmapIntelligenceService } from './roadmap-intelligence.service';
import { ProjectGapService } from './project-gap.service';
import { FreshnessRecommendationService } from '../learning/freshness-recommendation.service';
import { PaceAdaptationService } from '../learning/pace-adaptation.service';
import type { MaterializeOptions } from './roadmap-materialization.service';
import { ImportRoadmapDto } from './dto/import-roadmap.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { GoalChangeImpactRequestDto, DecomposeNodeRequestDto, DismissDecompositionRequestDto } from './dto/roadmap-intelligence.dto';
import { RoadmapStatus, RoadmapPriority } from '@prisma/client';

@Controller('api/v1/roadmaps')
export class RoadmapController {
  constructor(
    private readonly roadmapService: RoadmapService,
    private readonly reconciliationService: RoadmapReconciliationService,
    private readonly materializationService: RoadmapMaterializationService,
    private readonly intelligenceService: RoadmapIntelligenceService,
    private readonly projectGapService: ProjectGapService,
    private readonly freshnessRecommendationService: FreshnessRecommendationService,
    private readonly paceAdaptationService: PaceAdaptationService,
  ) {}

  @Post('import')
  async importRoadmap(
    @Req() req: any,
    @Body() importDto: ImportRoadmapDto,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.importRoadmap(userId, importDto);
  }

  @Get()
  async getRoadmaps(@Req() req: any) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.getRoadmaps(userId);
  }

  @Get('daily-focus')
  async getDailyFocus(
    @Req() req: any,
    @Query('availableHours') availableHours?: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    const hours = availableHours ? parseFloat(availableHours) : 2.5;
    return this.materializationService.getDailyFocus(userId, hours);
  }

  @Get(':id')
  async getRoadmapById(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.getRoadmapById(userId, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: RoadmapStatus,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.updateRoadmapStatus(userId, id, status);
  }

  @Patch(':id/priority')
  async updatePriority(
    @Req() req: any,
    @Param('id') id: string,
    @Body('priority') priority: RoadmapPriority,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.updateRoadmapPriority(userId, id, priority);
  }

  @Delete(':id')
  async softDeleteRoadmap(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.softDeleteRoadmap(userId, id);
  }

  @Post(':id/reopen')
  async reopenRoadmap(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.reopenRoadmap(userId, id);
  }

  @Post(':id/reconcile')
  async reconcile(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    const roadmap = await this.roadmapService.getRoadmapById(userId, id);
    const activeSnapshot = roadmap.snapshots[0];
    return this.reconciliationService.reconcileSnapshot(userId, activeSnapshot.id);
  }

  @Post(':id/materialize')
  async materialize(
    @Req() req: any,
    @Param('id') id: string,
    @Body() options: MaterializeOptions,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.materializationService.materializeActionableTasks(userId, id, options);
  }

  @Get(':id/completion-candidate')
  async checkCompletionCandidate(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.checkCompletionCandidate(userId, id);
  }

  @Post(':id/review-completion')
  async reviewCompletion(
    @Req() req: any,
    @Param('id') id: string,
    @Body('confirm') confirm: boolean,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.reviewCompletion(userId, id, confirm);
  }

  @Post(':id/skip-impact/:nodeId')
  async analyzeSkipImpact(
    @Req() req: any,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.analyzeSkipImpact(userId, id, nodeId);
  }

  @Post('mappings/:mappingId/self-report')
  async selfReportKnowledge(
    @Req() req: any,
    @Param('mappingId') mappingId: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.selfReportKnowledge(userId, mappingId);
  }

  @Patch('mappings/:mappingId')
  async updateMapping(
    @Req() req: any,
    @Param('mappingId') mappingId: string,
    @Body() dto: UpdateMappingDto,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.roadmapService.updateMapping(userId, mappingId, dto);
  }

  // --- SUB-BLOCK 6A ENDPOINTS ---

  @Post(':id/impact-analysis')
  async analyzeGoalChangeImpact(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: GoalChangeImpactRequestDto,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.intelligenceService.analyzeGoalChangeImpact(userId, id, dto);
  }

  @Get(':id/complementary-context')
  async getComplementaryContext(
    @Req() req: any,
    @Param('id') id: string,
    @Query('nodeId') nodeId?: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.intelligenceService.getComplementaryContext(userId, id, nodeId);
  }

  @Post('nodes/:nodeId/decompose')
  async decomposeNode(
    @Req() req: any,
    @Param('nodeId') nodeId: string,
    @Body() dto: DecomposeNodeRequestDto,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.intelligenceService.decomposeNode(userId, nodeId, dto);
  }

  @Post('nodes/:nodeId/dismiss-decomposition')
  async dismissDecomposition(
    @Req() req: any,
    @Param('nodeId') nodeId: string,
    @Body() dto: DismissDecompositionRequestDto,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.intelligenceService.dismissDecomposition(userId, nodeId, dto);
  }

  // --- SUB-BLOCK 6B ENDPOINTS ---

  @Get(':id/project-gaps')
  async analyzeProjectGaps(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.projectGapService.analyzeProjectGaps(userId, id);
  }

  // --- SUB-BLOCK 6C ENDPOINTS ---

  @Get(':id/freshness-recommendations')
  async getRoadmapFreshnessRecommendations(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.freshnessRecommendationService.getRoadmapFreshnessRecommendations(userId, id);
  }

  // --- SUB-BLOCK 6D ENDPOINTS ---

  @Get(':id/adaptation')
  async getRoadmapPaceAdaptation(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id || 'default-user-id';
    return this.paceAdaptationService.getRoadmapPaceAdaptation(userId, id);
  }
}
