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
import { EvidenceService } from './evidence.service';
import { GitHubEvidenceService } from './github-evidence.service';
import { SubmitGitHubRepoDto } from './dto/github-evidence.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/evidence')
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly githubEvidenceService: GitHubEvidenceService,
  ) {}

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.evidenceService.createEvidence(user.id, body);
  }

  @Post('github-repo')
  submitGitHubRepo(@CurrentUser() user: any, @Body() dto: SubmitGitHubRepoDto) {
    return this.githubEvidenceService.submitGitHubRepository(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('taskId') taskId?: string) {
    return this.evidenceService.getEvidence(user.id, taskId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.evidenceService.getEvidenceById(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.evidenceService.updateEvidence(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.evidenceService.deleteEvidence(user.id, id);
  }
}
