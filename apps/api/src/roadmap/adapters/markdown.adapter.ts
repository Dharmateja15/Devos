import { RoadmapSourceAdapter } from './roadmap-adapter.interface';
import { NormalizedRoadmap, NormalizedRoadmapNode } from '../roadmap.types';
import { RoadmapSourceType, RoadmapNodeType } from '@prisma/client';
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class MarkdownAdapter implements RoadmapSourceAdapter {
  canHandle(input: string): boolean {
    return input.includes('# ') || input.includes('.md');
  }

  async normalize(input: string): Promise<NormalizedRoadmap> {
    const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      throw new BadRequestException('Empty Markdown data');
    }

    const nodes: NormalizedRoadmapNode[] = [];
    let title = 'Markdown Imported Roadmap';
    let currentParentId: string | undefined = undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('# ')) {
        title = line.replace('# ', '').trim();
      } else if (line.startsWith('## ')) {
        const id = `md-node-${i}`;
        nodes.push({
          externalId: id,
          title: line.replace('## ', '').trim(),
          nodeType: RoadmapNodeType.MILESTONE,
          sortOrder: i,
          dependencies: [],
          resourceUrls: [],
          metadata: {}
        });
        currentParentId = id;
      } else if (line.startsWith('- ')) {
        nodes.push({
          externalId: `md-node-${i}`,
          parentId: currentParentId,
          title: line.replace('- ', '').trim(),
          nodeType: RoadmapNodeType.TOPIC,
          sortOrder: i,
          dependencies: currentParentId ? [currentParentId] : [],
          resourceUrls: [],
          metadata: {}
        });
      }
    }

    return {
      sourceName: title,
      sourceType: RoadmapSourceType.MARKDOWN,
      nodes,
      metadata: { format: 'markdown-list' }
    };
  }
}
