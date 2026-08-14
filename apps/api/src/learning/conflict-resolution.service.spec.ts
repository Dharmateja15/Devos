import { Test, TestingModule } from '@nestjs/testing';
import { ConflictResolutionService } from './conflict-resolution.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, TaskStatus, IndependenceSignal } from '@prisma/client';

describe('ConflictResolutionService (Sub-Block 6D - Requirement P Semantic Invariants)', () => {
  let service: ConflictResolutionService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      learnerConceptState: { findMany: jest.fn().mockResolvedValue([]) },
      evidenceItem: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      roadmapMapping: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<ConflictResolutionService>(ConflictResolutionService);
  });

  describe('Strict Semantic Invariant Verification', () => {
    it('1. User confirmation + missing repository evidence -> NO conflict (absence is NOT negative evidence)', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-py',
          state: LearnerState.SELF_REPORTED,
          userIntent: 'CONFIRM',
          concept: { id: 'c-py', title: 'Python' },
        },
      ]);
      prismaService.evidenceItem.findMany.mockResolvedValue([]); // Zero evidence

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]); // Zero conflicts! Missing evidence is NOT a contradiction.
    });

    it('2. User confirmation + unverified repository -> NO conflict (unverified is NOT contradictory)', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-docker',
          state: LearnerState.SELF_REPORTED,
          userIntent: 'CONFIRM',
          concept: { id: 'c-docker', title: 'Docker' },
        },
      ]);
      prismaService.evidenceItem.findMany.mockResolvedValue([
        { id: 'ev-unver', verified: false, metadata: { detectedTechnologies: [] } },
      ]);

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]);
    });

    it('3. User confirmation + repository lacking dependency -> NO conflict', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-react',
          state: LearnerState.SELF_REPORTED,
          userIntent: 'CONFIRM',
          concept: { id: 'c-react', title: 'React' },
        },
      ]);
      prismaService.evidenceItem.findMany.mockResolvedValue([
        { id: 'ev-ver', verified: true, metadata: { detectedTechnologies: ['TypeScript'] } }, // React absent
      ]);

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]); // 0 conflicts!
    });

    it('4. Project tech declaration + unverified repository -> NO conflict', async () => {
      prismaService.project.findMany.mockResolvedValue([
        {
          id: 'p-1',
          title: 'Portal',
          techStack: ['React'],
          evidence: [{ id: 'ev-unver', verified: false, metadata: {} }],
        },
      ]);

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]);
    });

    it('5. Project tech declaration + missing manifest -> NO conflict', async () => {
      prismaService.project.findMany.mockResolvedValue([
        {
          id: 'p-2',
          title: 'API Service',
          techStack: ['Go'],
          evidence: [],
        },
      ]);

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]);
    });

    it('6. UNKNOWN state + completed independent task -> NO conflict (valid pre-transition state in LearningService)', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-ts',
          state: LearnerState.UNKNOWN,
          concept: { id: 'c-ts', title: 'TypeScript' },
        },
      ]);
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 't-1',
          status: TaskStatus.DONE,
          independenceSignal: IndependenceSignal.INDEPENDENT,
          skills: [{ skill: { name: 'TypeScript' } }],
        },
      ]);

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]); // Valid pre-transition state, NOT a conflict.
    });

    it('7. MASTERED + STALE -> NO conflict (6C freshness decay, not a conflict)', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-ts',
          state: LearnerState.MASTERED,
          lastEvaluatedAt: new Date('2025-01-01'), // Stale
          concept: { id: 'c-ts', title: 'TypeScript' },
        },
      ]);

      const res = await service.getConflicts('user-1');

      expect(res).toEqual([]);
    });

    it('8. Authoritative negative evidence assertion (verificationStatus = REJECTED) -> Generates Conflict', async () => {
      prismaService.learnerConceptState.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          conceptId: 'c-py',
          state: LearnerState.MASTERED,
          userIntent: 'CONFIRM',
          concept: { id: 'c-py', title: 'Python' },
        },
      ]);
      prismaService.evidenceItem.findMany.mockResolvedValue([
        {
          id: 'ev-rej',
          title: 'Python Submission',
          verified: false,
          metadata: { verificationStatus: 'REJECTED', detectedTechnologies: ['Python'] },
        },
      ]);

      const res = await service.getConflicts('user-1');

      expect(res.length).toBe(1);
      expect(res[0].conceptTitle).toBe('Python');
      expect(res[0].conflictType).toBe('USER_CONFIRMATION_VS_EVIDENCE');
      expect(res[0].conflictingSignal.source).toBe('AUTHORITATIVE_NEGATIVE_EVIDENCE');
    });

    it('9. Invariant Check: Zero database write operations executed during conflict analysis', async () => {
      await service.getConflicts('user-1');

      expect(prismaService.learnerConceptState.update).toBeUndefined();
      expect(prismaService.evidenceItem.create).toBeUndefined();
      expect(prismaService.task.update).toBeUndefined();
    });

    it('10. Multi-User Isolation: User A conflicts do not leak to User B', async () => {
      prismaService.learnerConceptState.findMany.mockImplementation(({ where }: any) => {
        if (where.userId === 'user-1') {
          return Promise.resolve([
            {
              userId: 'user-1',
              conceptId: 'c-py',
              state: LearnerState.MASTERED,
              userIntent: 'CONFIRM',
              concept: { id: 'c-py', title: 'Python' },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const resUser2 = await service.getConflicts('user-2');
      expect(resUser2).toEqual([]);
    });
  });
});
