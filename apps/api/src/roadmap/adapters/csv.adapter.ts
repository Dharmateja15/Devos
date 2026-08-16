import { RoadmapSourceAdapter } from './roadmap-adapter.interface';
import { NormalizedRoadmap, NormalizedRoadmapNode } from '../roadmap.types';
import { RoadmapSourceType, RoadmapNodeType } from '@prisma/client';
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class CsvAdapter implements RoadmapSourceAdapter {
  canHandle(input: string): boolean {
    return input.trim().startsWith('id,title') || input.includes('.csv');
  }

  async normalize(input: string): Promise<NormalizedRoadmap> {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      throw new BadRequestException('Empty CSV data');
    }

    const headers = lines[0].split(',').map((h) => h.toLowerCase());
    const nodes: NormalizedRoadmapNode[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(','); // Simplified naive CSV parsing for MVP
      const nodeData: any = {};

      headers.forEach((header, index) => {
        nodeData[header] = parts[index] || '';
      });

      let nodeType: RoadmapNodeType = RoadmapNodeType.TOPIC;
      const t = (nodeData.type || '').toUpperCase();
      if (t in RoadmapNodeType) {
        nodeType = t as RoadmapNodeType;
      }

      nodes.push({
        externalId: nodeData.id || `csv-row-${i}`,
        parentId: nodeData.parentid || undefined,
        title: nodeData.title || `Row ${i}`,
        description: nodeData.description,
        nodeType,
        sortOrder: parseInt(nodeData.sortorder, 10) || i,
        dependencies: nodeData.dependencies
          ? nodeData.dependencies.split('|')
          : [],
        resourceUrls: nodeData.resources ? nodeData.resources.split('|') : [],
        metadata: { source: 'csv' },
      });
    }

    return {
      sourceName: 'CSV Imported Roadmap',
      sourceType: RoadmapSourceType.CSV,
      nodes,
      metadata: { rowCount: nodes.length },
    };
  }
}
