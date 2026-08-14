import { RoadmapSourceType } from '@prisma/client';

export class ImportRoadmapDto {
  sourceType: RoadmapSourceType;
  input: string; // URL, raw JSON, CSV text, or Markdown text
  sourceName?: string;
  sourceVersion?: string;
  targetRoadmapId?: string;
  createNewRoadmap?: boolean;
}
