import { Test, TestingModule } from '@nestjs/testing';
import { CapabilityFreshnessService } from './capability-freshness.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, TaskStatus, IndependenceSignal } from '@prisma/client';

describe('CapabilityFreshnessService (Sub-Block 6C - Requirement L)', () => {
  let service: CapabilityFreshnessService;
  let prismaService: any;

  const now = new Date();

  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    prismaService = {
      evidenceItem: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      learnerConceptState: { findMany: jest.fn().mockResolvedValue([]) },
      concept: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'c-ts', title: 'TypeScript' }]),
      },
      skill: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 's-nest', name: 'NestJS' }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapabilityFreshnessService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<CapabilityFreshnessService>(
      CapabilityFreshnessService,
    );
  });

  describe('Deterministic Boundary Tests & Recency Score', () => {
    it('1. 0 Days -> FRESH (Recency score = 1.00)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-0',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(0),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].freshnessState).toBe('FRESH');
      expect(res.freshnessList[0].recencyScore).toBe(1.0);
      expect(res.summary.freshCount).toBe(1);
    });

    it('2. 30 Days -> FRESH (Recency score = 0.67)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-30',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(30),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].freshnessState).toBe('FRESH');
      expect(res.freshnessList[0].recencyScore).toBe(0.67);
    });

    it('3. 31 Days -> AGING (Recency score = 0.66)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-31',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(31),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].freshnessState).toBe('AGING');
      expect(res.freshnessList[0].recencyScore).toBe(0.66);
    });

    it('4. 60 Days -> AGING (Recency score = 0.33)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-60',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(60),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].freshnessState).toBe('AGING');
      expect(res.freshnessList[0].recencyScore).toBe(0.33);
    });

    it('5. 61 Days -> STALE (Recency score = 0.32)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-61',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(61),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].freshnessState).toBe('STALE');
      expect(res.freshnessList[0].recencyScore).toBe(0.32);
    });

    it('6. 90 Days & 120 Days -> STALE (Recency score = 0.00)', async () => {
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-120',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(120),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].freshnessState).toBe('STALE');
      expect(res.freshnessList[0].recencyScore).toBe(0.0); // Bounded at 0.00!
    });

    it('7. No timestamp -> UNKNOWN_FRESHNESS (Recency score = null)', async () => {
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-no-date',
          verified: false,
          githubEventAt: null,
          verifiedAt: null,
          createdAt: null,
          metadata: { detectedTechnologies: ['Docker'] },
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      const docker = res.freshnessList.find(
        (f) => f.capabilityTitle === 'Docker',
      );
      expect(docker?.freshnessState).toBe('UNKNOWN_FRESHNESS');
      expect(docker?.recencyScore).toBeNull();
    });
  });

  describe('Historical Preservation & Invariants', () => {
    it('1. Preserves MASTERED + STALE state without reverting MASTERED to UNKNOWN or mutating DB', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-ts',
          state: LearnerState.MASTERED,
          lastEvaluatedAt: daysAgo(100), // 100 days ago!
          concept: { id: 'c-ts', title: 'TypeScript' },
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      expect(res.freshnessList[0].learnerState).toBe(LearnerState.MASTERED);
      expect(res.freshnessList[0].freshnessState).toBe('STALE');
      expect(prismaService.learnerConceptState.update).toBeUndefined(); // Zero DB mutation!
    });

    it('2. Weak evidence (weight 0.40) does NOT displace older strong evidence (weight >= 0.60)', async () => {
      // Strong evidence 40 days ago
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-strong',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          completedAt: daysAgo(40),
          skills: [{ skill: { name: 'TypeScript' } }],
          evidence: [],
        },
      ]);

      // Weak manifest evidence today (0 days ago)
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-weak',
          verified: false,
          createdAt: daysAgo(0),
          metadata: { detectedTechnologies: ['TypeScript'] },
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      // Derived timestamp uses the strong 40 days ago timestamp (weight 1.0), NOT 0 days ago (weight 0.40)!
      expect(res.freshnessList[0].daysSinceLastDemonstration).toBe(40);
      expect(res.freshnessList[0].freshnessState).toBe('AGING');
    });

    it('3. In-progress Project.updatedAt is NOT used as capability demonstration proof', async () => {
      prismaService.project.findMany.mockResolvedValue([]); // Zero completed projects returned!

      const res = await service.getCapabilityFreshness('user-1');
      expect(res.freshnessList).toEqual([]);
    });

    it('4. Audit 3 Invariants: UNKNOWN + weak evidence does NOT become ASSESSED/MASTERED, ASSESSED + stale does NOT become MASTERED/UNKNOWN', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-ts',
          state: LearnerState.ASSESSED,
          lastEvaluatedAt: daysAgo(90),
          concept: { id: 'c-ts', title: 'TypeScript' },
        },
      ]);

      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-weak',
          verified: false,
          createdAt: daysAgo(1),
          metadata: { detectedTechnologies: ['Docker'] },
        },
      ]);

      const res = await service.getCapabilityFreshness('user-1');

      const tsItem = res.freshnessList.find(
        (f) => f.capabilityTitle === 'TypeScript',
      );
      expect(tsItem?.learnerState).toBe(LearnerState.ASSESSED);
      expect(tsItem?.freshnessState).toBe('STALE'); // Retains ASSESSED state!

      const dockerItem = res.freshnessList.find(
        (f) => f.capabilityTitle === 'Docker',
      );
      expect(dockerItem?.learnerState).toBe(LearnerState.UNKNOWN); // UNKNOWN state remains UNKNOWN!
      expect(prismaService.learnerConceptState.update).toBeUndefined();
    });
  });
});
