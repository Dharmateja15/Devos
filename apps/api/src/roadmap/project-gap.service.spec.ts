import { Test, TestingModule } from '@nestjs/testing';
import { ProjectGapService } from './project-gap.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapNodeType, ProjectStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProjectGapService (Sub-Block 6B)', () => {
  let service: ProjectGapService;
  let prismaService: any;

  const mockProjectNode = {
    id: 'node-project-1',
    title: 'Build REST API',
    nodeType: RoadmapNodeType.PROJECT,
    dependencies: ['TypeScript', 'NestJS'],
    metadata: { requiredSkills: ['TypeScript', 'NestJS'] },
    mappings: [],
  };

  const mockRoadmap = {
    id: 'rm-1',
    userId: 'user-1',
    title: 'Backend Engineering',
    deletedAt: null,
    snapshots: [
      {
        id: 'snap-1',
        nodes: [mockProjectNode],
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      roadmap: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.id === 'rm-1') return Promise.resolve(mockRoadmap);
          if (where.id === 'rm-other')
            return Promise.resolve({
              ...mockRoadmap,
              id: 'rm-other',
              userId: 'user-other',
            });
          return Promise.resolve(null);
        }),
      },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      evidenceItem: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectGapService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<ProjectGapService>(ProjectGapService);
  });

  describe('Project Gap Analysis & Non-Fabrication Rule', () => {
    it('1. Returns MISSING status when no matching project or evidence exists', async () => {
      const res = await service.analyzeProjectGaps('user-1', 'rm-1');

      expect(res.totalProjectNodes).toBe(1);
      expect(res.missingCount).toBe(1);
      expect(res.gaps[0].gapStatus).toBe('MISSING');
      expect(res.gaps[0].requiredTechStack).toEqual(['TypeScript', 'NestJS']);
      // Non-fabrication check: Does not invent Docker or Redis!
      expect(res.gaps[0].requiredTechStack).not.toContain('Docker');
    });

    it('2. Revision Correction 2: projectMatch alone sets IN_PROGRESS, NOT EVIDENCE_FOUND', async () => {
      prismaService.project.findMany.mockResolvedValue([
        {
          id: 'proj-1',
          title: 'Build REST API',
          status: ProjectStatus.IN_PROGRESS,
          techStack: ['TypeScript', 'NestJS'],
          journey: { userId: 'user-1' },
          evidence: [],
        },
      ]);
      // Zero EvidenceItems in DB!
      prismaService.evidenceItem.findMany.mockResolvedValue([]);

      const res = await service.analyzeProjectGaps('user-1', 'rm-1');

      expect(res.gaps[0].projectMatch).toBe(true);
      expect(res.gaps[0].evidenceFound).toBe(false);
      expect(res.gaps[0].gapStatus).toBe('IN_PROGRESS'); // Crucial revision check!
    });

    it('3. Sets EVIDENCE_FOUND status when actual EvidenceItems exist matching tech stack', async () => {
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          userId: 'user-1',
          title: 'GitHub Repository: user/api-repo',
          metadata: { detectedTechnologies: ['TypeScript', 'NestJS'] },
        },
      ]);

      const res = await service.analyzeProjectGaps('user-1', 'rm-1');

      expect(res.gaps[0].evidenceFound).toBe(true);
      expect(res.gaps[0].gapStatus).toBe('EVIDENCE_FOUND');
      expect(res.gaps[0].matchedEvidenceIds).toContain('ev-1');
    });

    it('4. Sets SATISFIED status when linked completed project has evidence', async () => {
      prismaService.project.findMany.mockResolvedValue([
        {
          id: 'proj-completed',
          title: 'Build REST API',
          status: ProjectStatus.COMPLETED,
          techStack: ['TypeScript', 'NestJS'],
          journey: { userId: 'user-1' },
          evidence: [{ id: 'ev-1' }],
        },
      ]);

      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          userId: 'user-1',
          title: 'Build REST API Evidence',
          metadata: { detectedTechnologies: ['TypeScript', 'NestJS'] },
        },
      ]);

      const res = await service.analyzeProjectGaps('user-1', 'rm-1');

      expect(res.gaps[0].gapStatus).toBe('SATISFIED');
      expect(res.satisfiedCount).toBe(1);
    });

    it('5. Rejects unauthorized user access with ForbiddenException', async () => {
      await expect(
        service.analyzeProjectGaps('user-1', 'rm-other'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Multi-User Evidence Isolation', () => {
    it('User A evidence is completely invisible to User B project gap analysis', async () => {
      // Mock User 2 roadmap
      prismaService.roadmap.findUnique.mockResolvedValue({
        ...mockRoadmap,
        id: 'rm-user2',
        userId: 'user-2',
      });

      // User 1 has evidence in DB
      prismaService.evidenceItem.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.userId === 'user-1') {
            return Promise.resolve([
              {
                id: 'ev-user1',
                userId: 'user-1',
                title: 'REST API Repo',
                metadata: { detectedTechnologies: ['TypeScript'] },
              },
            ]);
          }
          return Promise.resolve([]); // User 2 has 0 evidence
        },
      );

      const user2Gaps = await service.analyzeProjectGaps('user-2', 'rm-user2');

      expect(user2Gaps.gaps[0].evidenceFound).toBe(false);
      expect(user2Gaps.gaps[0].gapStatus).toBe('MISSING');
      expect(user2Gaps.gaps[0].matchedEvidenceIds).toEqual([]);
    });
  });
});
