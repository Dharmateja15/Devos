import { Controller, Get, Req } from '@nestjs/common';
import { CapabilityDiscoveryService } from './capability-discovery.service';
import { CapabilityFreshnessService } from './capability-freshness.service';

@Controller('api/v1/capabilities')
export class CapabilitiesController {
  constructor(
    private readonly discoveryService: CapabilityDiscoveryService,
    private readonly freshnessService: CapabilityFreshnessService
  ) {}

  @Get('discovered')
  async getDiscoveredCapabilities(@Req() req: any) {
    const userId = req?.user?.id || 'default-user-id';
    return this.discoveryService.getDiscoveredCapabilities(userId);
  }

  @Get('freshness')
  async getCapabilityFreshness(@Req() req: any) {
    const userId = req?.user?.id || 'default-user-id';
    return this.freshnessService.getCapabilityFreshness(userId);
  }
}
