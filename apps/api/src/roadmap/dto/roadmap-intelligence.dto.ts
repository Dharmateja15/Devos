import { RoadmapPriority, RoadmapStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';

export class GoalChangeImpactRequestDto {
  @IsEnum(RoadmapPriority)
  @IsOptional()
  targetPriority?: RoadmapPriority;

  @IsEnum(RoadmapStatus)
  @IsOptional()
  targetStatus?: RoadmapStatus;
}

export class DecomposeNodeRequestDto {
  @IsBoolean()
  @IsOptional()
  forceDecomposition?: boolean;
}

export class DismissDecompositionRequestDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
