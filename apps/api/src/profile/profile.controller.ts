import { Controller, Get, Param } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('api/v1/p')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.profileService.getPublicProfile(username);
  }

  @Get(':username/activity')
  async getPublicActivity(@Param('username') username: string) {
    return this.profileService.getPublicActivity(username);
  }
}
