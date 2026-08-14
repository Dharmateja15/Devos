import { MappingStatus } from '@prisma/client';

export class UpdateMappingDto {
  mappingStatus?: MappingStatus;
  confidenceScore?: number;
  matchingReason?: string;
  userConfirmation?: boolean;
  journeyId?: string;
  taskId?: string;
  projectId?: string;
  skillId?: string;
}
