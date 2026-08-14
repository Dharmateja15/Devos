import { RoadmapPriority, RoadmapStatus } from '@prisma/client';

export class GoalChangeImpactRequestDto {
  targetPriority?: RoadmapPriority;
  targetStatus?: RoadmapStatus;
}

export class DecomposeNodeRequestDto {
  forceDecomposition?: boolean;
}

export class DismissDecompositionRequestDto {
  reason?: string;
}
