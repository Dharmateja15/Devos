import { RoadmapNodeType, RoadmapSourceType } from '@prisma/client';

export interface NormalizedRoadmapNode {
  externalId: string;
  parentId?: string;
  title: string;
  description?: string;
  nodeType: RoadmapNodeType;
  sortOrder: number;
  dependencies: string[];
  resourceUrls: string[];
  metadata: Record<string, any>;
}

export interface NormalizedRoadmap {
  sourceName: string;
  sourceType: RoadmapSourceType;
  sourceUrl?: string;
  sourceVersion?: string;
  nodes: NormalizedRoadmapNode[];
  metadata: Record<string, any>;
}
