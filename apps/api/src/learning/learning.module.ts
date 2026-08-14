import { Module } from '@nestjs/common';
import { LearningService } from './learning.service';
import { LearningController } from './learning.controller';
import { RecommendationService } from './recommendation/recommendation.service';
import { CapabilityDiscoveryService } from './capability-discovery.service';
import { CapabilityFreshnessService } from './capability-freshness.service';
import { FreshnessRecommendationService } from './freshness-recommendation.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { RecommendationSuppressionService } from './recommendation-suppression.service';
import { PaceAdaptationService } from './pace-adaptation.service';
import { CapabilitiesController } from './capabilities.controller';

@Module({
  providers: [
    LearningService,
    RecommendationService,
    CapabilityDiscoveryService,
    CapabilityFreshnessService,
    FreshnessRecommendationService,
    ConflictResolutionService,
    RecommendationSuppressionService,
    PaceAdaptationService,
  ],
  controllers: [
    LearningController,
    CapabilitiesController,
  ],
  exports: [
    CapabilityDiscoveryService,
    CapabilityFreshnessService,
    FreshnessRecommendationService,
    ConflictResolutionService,
    RecommendationSuppressionService,
    PaceAdaptationService,
  ],
})
export class LearningModule {}
