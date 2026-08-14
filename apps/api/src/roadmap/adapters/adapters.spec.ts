import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RoadmapShAdapter } from './roadmapsh.adapter';
import { CsvAdapter } from './csv.adapter';
import { MarkdownAdapter } from './markdown.adapter';
import { RoadmapSourceType, RoadmapNodeType } from '@prisma/client';

describe('Roadmap Adapters', () => {
  describe('RoadmapShAdapter', () => {
    let adapter: RoadmapShAdapter;

    beforeEach(() => {
      adapter = new RoadmapShAdapter();
    });

    it('canHandle detects roadmap.sh URLs or prefix', () => {
      expect(adapter.canHandle('https://roadmap.sh/ai-engineer')).toBe(true);
      expect(adapter.canHandle('roadmapsh:ai')).toBe(true);
      expect(adapter.canHandle('something else')).toBe(false);
    });

    it('rejects invalid string that is neither URL nor JSON', async () => {
      await expect(adapter.normalize('invalid-string')).rejects.toThrow(BadRequestException);
    });

    it('normalizes mock JSON correctly', async () => {
      const mockJson = JSON.stringify({
        title: 'Test Roadmap',
        nodes: [{ id: 'n1', title: 'Node 1', type: 'skill' }]
      });
      const result = await adapter.normalize(mockJson);
      expect(result.sourceType).toBe(RoadmapSourceType.ROADMAP_SH);
      expect(result.sourceName).toBe('Test Roadmap');
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].nodeType).toBe(RoadmapNodeType.SKILL);
      expect(result.nodes[0].externalId).toBe('n1');
    });
  });

  describe('CsvAdapter', () => {
    let adapter: CsvAdapter;

    beforeEach(() => {
      adapter = new CsvAdapter();
    });

    it('canHandle detects csv headers or extension', () => {
      expect(adapter.canHandle('id,title,type\n1,Test,topic')).toBe(true);
      expect(adapter.canHandle('file.csv')).toBe(true);
    });

    it('normalizes simple CSV string', async () => {
      const csv = `id,title,type\nn1,First Topic,topic`;
      const result = await adapter.normalize(csv);
      expect(result.sourceType).toBe(RoadmapSourceType.CSV);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].externalId).toBe('n1');
      expect(result.nodes[0].title).toBe('First Topic');
    });
  });

  describe('MarkdownAdapter', () => {
    let adapter: MarkdownAdapter;

    beforeEach(() => {
      adapter = new MarkdownAdapter();
    });

    it('canHandle detects markdown headers', () => {
      expect(adapter.canHandle('# My Roadmap')).toBe(true);
      expect(adapter.canHandle('file.md')).toBe(true);
    });

    it('normalizes markdown lists into hierarchies', async () => {
      const md = `# Target Roadmap\n## Phase 1\n- Learn JS\n- Learn React`;
      const result = await adapter.normalize(md);
      expect(result.sourceType).toBe(RoadmapSourceType.MARKDOWN);
      expect(result.sourceName).toBe('Target Roadmap');
      // 1 milestone + 2 topics = 3 nodes
      expect(result.nodes.length).toBe(3);
      expect(result.nodes[0].nodeType).toBe(RoadmapNodeType.MILESTONE);
      expect(result.nodes[1].title).toBe('Learn JS');
      expect(result.nodes[1].parentId).toBe(result.nodes[0].externalId);
    });
  });
});
