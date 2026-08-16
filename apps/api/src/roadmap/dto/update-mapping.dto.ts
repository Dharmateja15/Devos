import { MappingStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
} from 'class-validator';

export class UpdateMappingDto {
  @IsEnum(MappingStatus)
  @IsOptional()
  mappingStatus?: MappingStatus;

  @IsNumber()
  @IsOptional()
  confidenceScore?: number;

  @IsString()
  @IsOptional()
  matchingReason?: string;

  @IsBoolean()
  @IsOptional()
  userConfirmation?: boolean;

  @IsString()
  @IsOptional()
  journeyId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  skillId?: string;
}
