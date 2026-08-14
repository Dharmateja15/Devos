import { Test, TestingModule } from '@nestjs/testing';
import { CapabilityDiscoveryService } from './capability-discovery.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndependenceSignal, TaskStatus, LearnerState } from '@prisma/client';

describe('CapabilityDiscoveryService (Sub-Block 6C - Requirement K)', () => {
  let service: CapabilityDiscoveryService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      evidenceItem: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      learnerConceptState: { findMany: jest.fn().mockResolvedValue([]) },
      roadmapMapping: { findMany: jest.fn().mockResolvedValue([]) },
      concept: { findMany: jest.fn().mockResolvedValue([{ id: 'c-ts', title: 'TypeScript' }]) },
      skill: { findMany: jest.fn().mockResolvedValue([{ id: 's-nest', name: 'NestJS' }]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapabilityDiscoveryService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<CapabilityDiscoveryService>(CapabilityDiscoveryService);
  });

  describe('Signal Strength Tiers & Non-Mutation', () => {
    it('1. Classifies STRONG signal for assessed independent task completion', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-1',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: new Date('2026-08-01'),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getDiscoveredCapabilities('user-1');

      expect(res.totalDiscovered).toBe(1);
      expect(res.capabilities[0].capabilityTitle).toBe('TypeScript');
      expect(res.capabilities[0].signalStrength).toBe('STRONG');
      expect(res.capabilities[0].isCanonical).toBe(true);
      expect(res.capabilities[0].canonicalConceptId).toBe('c-ts');
    });

    it('2. Classifies MEDIUM signal for verified GitHub repository evidence', async () => {
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          verified: true,
          githubEventAt: new Date('2026-08-05'),
          metadata: {
            detectedTechnologies: ['NestJS'],
            verificationStatus: 'REPOSITORY_OWNER_VERIFIED',
          },
        },
      ]);

      const res = await service.getDiscoveredCapabilities('user-1');

      expect(res.totalDiscovered).toBe(1);
      expect(res.capabilities[0].capabilityTitle).toBe('NestJS');
      expect(res.capabilities[0].signalStrength).toBe('MEDIUM');
      expect(res.capabilities[0].canonicalSkillId).toBe('s-nest');
    });

    it('3. Classifies WEAK signal for static manifest technology detection', async () => {
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-2',
          verified: false, // Unverified
          metadata: {
            detectedTechnologies: ['Docker'],
            verificationStatus: 'PUBLIC_REPOSITORY_SUBMISSION',
          },
        },
      ]);

      const res = await service.getDiscoveredCapabilities('user-1');

      expect(res.totalDiscovered).toBe(1);
      expect(res.capabilities[0].capabilityTitle).toBe('Docker');
      expect(res.capabilities[0].signalStrength).toBe('WEAK');
      expect(res.capabilities[0].isCanonical).toBe(false); // Unmapped candidate string
      expect(res.capabilities[0].capabilityId).toBe('tech-docker');
    });

    it('4. Invariant Check: WEAK signal does NOT produce DB mutations or mastery state change', async () => {
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-3',
          verified: false,
          metadata: { detectedTechnologies: ['Docker'] },
        },
      ]);

      const res = await service.getDiscoveredCapabilities('user-1');

      // Verify zero DB write methods called!
      expect(prismaService.evidenceItem.create).toBeUndefined();
      expect(prismaService.learnerConceptState?.update).toBeUndefined();
      expect(res.capabilities[0].signalStrength).toBe('WEAK');
    });

    it('5. Audit 1 & Audit 7: tech-<name> is candidate DTO string ONLY (no Concept/Skill creation, zero DB write)', async () => {
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-unmapped',
          verified: true,
          metadata: { detectedTechnologies: ['GraphQL'] },
        },
      ]);

      const res = await service.getDiscoveredCapabilities('user-1');

      const gqlCap = res.capabilities.find(c => c.capabilityTitle === 'GraphQL');
      expect(gqlCap).toBeDefined();
      expect(gqlCap?.capabilityId).toBe('tech-graphql');
      expect(gqlCap?.isCanonical).toBe(false);
      expect(gqlCap?.canonicalConceptId).toBeUndefined();
      expect(gqlCap?.canonicalSkillId).toBeUndefined();

      // Explicit Invariant Verification: Zero DB entity or mastery mutations!
      expect(prismaService.concept?.create).toBeUndefined();
      expect(prismaService.skill?.create).toBeUndefined();
      expect(prismaService.learnerConceptState?.create).toBeUndefined();
    });
  });

  describe('Multi-User Isolation', () => {
    it('User A capabilities are isolated from User B', async () => {
      prismaService.evidenceItem.findMany.mockImplementation(({ where }: any) => {
        if (where.userId === 'user-1') {
          return Promise.resolve([
            { id: 'ev-u1', verified: true, metadata: { detectedTechnologies: ['TypeScript'], verificationStatus: 'REPOSITORY_OWNER_VERIFIED' } },
          ]);
        }
        return Promise.resolve([]); // User 2 has zero evidence
      });

      const resUser2 = await service.getDiscoveredCapabilities('user-2');

      expect(resUser2.userId).toBe('user-2');
      expect(resUser2.totalDiscovered).toBe(0);
      expect(resUser2.capabilities).toEqual([]);
    });
  });
});
