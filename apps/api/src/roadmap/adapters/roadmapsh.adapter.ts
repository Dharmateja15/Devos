import { RoadmapSourceAdapter } from './roadmap-adapter.interface';
import { NormalizedRoadmap, NormalizedRoadmapNode } from '../roadmap.types';
import { RoadmapSourceType, RoadmapNodeType } from '@prisma/client';
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class RoadmapShAdapter implements RoadmapSourceAdapter {
  
  canHandle(input: string): boolean {
    return input.includes('roadmap.sh') || input.startsWith('roadmapsh:') || input.trim().startsWith('{') || input.trim().startsWith('[');
  }

  async normalize(input: string): Promise<NormalizedRoadmap> {
    // In a real implementation, this would fetch from roadmap.sh API or parse their JSON format.
    // We expect the input here to either be a URL (where we'd fetch) or a raw JSON string if mock/uploaded.
    
    let rawData: any;
    
    if (input.trim().startsWith('{') || input.trim().startsWith('[')) {
      try {
        rawData = JSON.parse(input);
      } catch (e) {
        throw new BadRequestException('Invalid JSON provided to RoadmapShAdapter');
      }
    } else if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        // Fetch real json payload from url if supported, or JSON endpoint
        const jsonUrl = input.endsWith('.json') ? input : `${input}.json`;
        const res = await fetch(jsonUrl);
        if (!res.ok) {
          throw new BadRequestException(`Failed to fetch roadmap from ${input}: HTTP status ${res.status}`);
        }
        rawData = await res.json();
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException(`Could not fetch or parse roadmap from URL: ${input} (${e.message || e})`);
      }
    } else {
      throw new BadRequestException('RoadmapShAdapter requires a valid JSON payload or HTTP URL.');
    }

    const title = rawData.title || 'Imported Roadmap.sh';
    const version = rawData.version || '1.0.0';

    const nodes: NormalizedRoadmapNode[] = (rawData.nodes || []).map((node: any, index: number) => {
      let nodeType: RoadmapNodeType = RoadmapNodeType.TOPIC;
      if (node.type === 'skill') nodeType = RoadmapNodeType.SKILL;
      else if (node.type === 'project') nodeType = RoadmapNodeType.PROJECT;
      else if (node.type === 'milestone') nodeType = RoadmapNodeType.MILESTONE;
      
      return {
        externalId: node.id || `node-${index}`,
        parentId: node.parentId,
        title: node.title || 'Untitled Node',
        description: node.description,
        nodeType,
        sortOrder: index,
        dependencies: node.dependencies || [],
        resourceUrls: node.resources || [],
        metadata: { originalType: node.type }
      };
    });

    return {
      sourceName: title,
      sourceType: RoadmapSourceType.ROADMAP_SH,
      sourceUrl: input.startsWith('http') ? input : undefined,
      sourceVersion: version,
      nodes,
      metadata: { rawFormat: 'roadmap.sh-v1' }
    };
  }
}
