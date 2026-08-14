import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Query } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post('journeys/:journeyId/milestones')
  create(@CurrentUser() user: any, @Param('journeyId') journeyId: string, @Body() body: any) {
    return this.milestonesService.createMilestone(user.id, journeyId, body);
  }

  @Get('journeys/:journeyId/milestones')
  findAllForJourney(
    @CurrentUser() user: any, 
    @Param('journeyId') journeyId: string,
    @Query('limit') limit?: string,
    @Query('after') cursor?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.milestonesService.getMilestones(user.id, journeyId, limitNum, cursor);
  }

  @Get('journeys/:journeyId/milestones/:id')
  findOne(@CurrentUser() user: any, @Param('journeyId') journeyId: string, @Param('id') id: string) {
    // Note: the service verifies journey ownership internally based on milestone.journeyId,
    // but we accept journeyId in the path for canonical routing.
    return this.milestonesService.getMilestone(user.id, id);
  }

  @Patch('journeys/:journeyId/milestones/:id')
  update(@CurrentUser() user: any, @Param('journeyId') journeyId: string, @Param('id') id: string, @Body() body: any) {
    return this.milestonesService.updateMilestone(user.id, id, body);
  }

  @Delete('journeys/:journeyId/milestones/:id')
  remove(@CurrentUser() user: any, @Param('journeyId') journeyId: string, @Param('id') id: string) {
    return this.milestonesService.deleteMilestone(user.id, id);
  }

  @Patch('journeys/:journeyId/milestones/reorder')
  reorderMilestones(@CurrentUser() user: any, @Param('journeyId') journeyId: string, @Body() body: { id: string, sort_order: number }[]) {
    return this.milestonesService.reorderMilestones(user.id, journeyId, body);
  }

  @Patch('milestones/:milestoneId/tasks/reorder')
  reorderTasks(@CurrentUser() user: any, @Param('milestoneId') milestoneId: string, @Body() body: { id: string, sort_order: number }[]) {
    return this.milestonesService.reorderTasks(user.id, milestoneId, body);
  }
}
