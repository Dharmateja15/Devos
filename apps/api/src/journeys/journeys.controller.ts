import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, Query } from '@nestjs/common';
import { JourneysService } from './journeys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.journeysService.createJourney(user.id, body);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('after') cursor?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.journeysService.getJourneys(user.id, limitNum, cursor);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journeysService.getJourney(user.id, id);
  }

  @Get(':id/stats')
  getStats(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journeysService.getStats(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.journeysService.updateJourney(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journeysService.deleteJourney(user.id, id);
  }
}
