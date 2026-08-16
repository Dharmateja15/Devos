import { RoadmapSourceType } from '@prisma/client';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class ImportRoadmapDto {
  @IsEnum(RoadmapSourceType)
  sourceType: RoadmapSourceType;

  @IsString()
  @IsNotEmpty()
  input: string; // URL, raw JSON, CSV text, or Markdown text

  @IsString()
  @IsOptional()
  sourceName?: string;

  @IsString()
  @IsOptional()
  sourceVersion?: string;

  @IsString()
  @IsOptional()
  targetRoadmapId?: string;

  @IsBoolean()
  @IsOptional()
  createNewRoadmap?: boolean;
}
