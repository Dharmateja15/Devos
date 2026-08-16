import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings')
  async getSettings(@CurrentUser() user: any) {
    return this.settingsService.getSettings(user.id);
  }

  @Patch('account')
  async updateAccount(@CurrentUser() user: any, @Body() body: any) {
    return this.settingsService.updateAccount(user.id, body);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() body: any) {
    return this.settingsService.updateProfile(user.id, body);
  }

  @Delete('github')
  async disconnectGithub(@CurrentUser() user: any) {
    return this.settingsService.disconnectGithub(user.id);
  }
}
