import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('milestones/:milestoneId/tasks')
  create(
    @CurrentUser() user: any,
    @Param('milestoneId') milestoneId: string,
    @Body() body: any,
  ) {
    return this.tasksService.createTask(user.id, milestoneId, body);
  }

  @Get('milestones/:milestoneId/tasks')
  findAllForMilestone(
    @CurrentUser() user: any,
    @Param('milestoneId') milestoneId: string,
    @Query('limit') limit?: string,
    @Query('after') cursor?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.tasksService.getTasks(user.id, milestoneId, limitNum, cursor);
  }

  @Get('tasks/:id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.getTask(user.id, id);
  }

  @Patch('tasks/:id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.tasksService.updateTask(user.id, id, body);
  }

  @Delete('tasks/:id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.deleteTask(user.id, id);
  }

  @Post('tasks/:id/complete')
  complete(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.tasksService.completeTask(
      user.id,
      id,
      body?.independenceSignal,
    );
  }

  @Post('tasks/:id/uncomplete')
  uncomplete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasksService.uncompleteTask(user.id, id);
  }
}
