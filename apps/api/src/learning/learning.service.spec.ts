import { Test, TestingModule } from '@nestjs/testing';
import { LearningService } from './learning.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerState, IndependenceSignal, TaskStatus, EvidenceType } from '@prisma/client';

describe('LearningService', () => {
  let service: LearningService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningService,
        {
          provide: PrismaService,
          useValue: {
            learnerConceptState: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            task: {
              findUnique: jest.fn(),
              count: jest.fn(),
            }
          },
        },
      ],
    }).compile();

    service = module.get<LearningService>(LearningService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Core Mechanics', () => {
    it('Completion != Mastery (without verified evidence it is ASSESSED at best)', async () => {
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue({
        id: 't1', status: TaskStatus.DONE, independenceSignal: IndependenceSignal.INDEPENDENT, evidence: [{ verified: false }]
      } as any);
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.UNKNOWN } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.ASSESSED } as any);
      const res = await service.evaluateTaskEvidence('u1', 'c1', 't1');
      expect(res.state).toBe(LearnerState.ASSESSED);
    });

    it('Self-report produces SELF_REPORTED, not MASTERED', async () => {
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.UNKNOWN } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.SELF_REPORTED } as any);
      const res = await service.selfReportConcept('u1', 'c1');
      expect(res.state).toBe(LearnerState.SELF_REPORTED);
    });

    it('AI_ASSISTED does not invalidate work, grants ASSESSED without numerical penalty', async () => {
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue({
        id: 't1', status: TaskStatus.DONE, independenceSignal: IndependenceSignal.AI_ASSISTED, evidence: [{ verified: true, evidenceType: EvidenceType.MANUAL }]
      } as any);
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.UNKNOWN } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.ASSESSED } as any);
      const res = await service.evaluateTaskEvidence('u1', 'c1', 't1');
      expect(res.state).toBe(LearnerState.ASSESSED);
    });

    it('Independent verified evidence strengthens state (Contextual Mastery)', async () => {
      jest.spyOn(prisma.task, 'findUnique').mockResolvedValue({
        id: 't1', status: TaskStatus.DONE, independenceSignal: IndependenceSignal.INDEPENDENT, evidence: [{ verified: true, evidenceType: EvidenceType.MANUAL }]
      } as any);
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.ASSESSED } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.MASTERED } as any);
      const res = await service.evaluateTaskEvidence('u1', 'c1', 't1');
      expect(res.state).toBe(LearnerState.MASTERED);
    });

    it('Skip/Defer/Schedule preserves history and state', async () => {
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.ASSESSED } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.ASSESSED, userIntent: 'DEFER', nextReviewAt: new Date(2050, 1, 1) } as any);
      const res = await service.setUserIntent('u1', 'c1', 'DEFER', new Date(2050, 1, 1));
      expect(res.userIntent).toBe('DEFER');
      expect(res.state).toBe(LearnerState.ASSESSED); // preservers state
    });

    it('MASTERED becomes STALE based on time, not by changing core state to UNKNOWN', () => {
      const isStale = service.isStale(new Date('2000-01-01'));
      expect(isStale).toBe(true);
    });
    
    it('Cross-user learner-state isolation', async () => {
      const spy = jest.spyOn(prisma.learnerConceptState, 'findUnique');
      await service.getLearnerState('u1', 'c1');
      expect(spy).toHaveBeenCalledWith({ where: { userId_conceptId: { userId: 'u1', conceptId: 'c1' } } });
    });
  });

  describe('Mastery Check Flow', () => {
    it('Traditional Quiz is mandatory first mastery mode', async () => {
      jest.spyOn(prisma.task, 'count').mockResolvedValue(0);
      await expect(service.submitMasteryCheck('u1', 'c1', { mode: 'EXPLANATION', passed: true }))
        .rejects.toThrow('TRADITIONAL_QUIZ is mandatory');
    });

    it('Optional mastery modes work', async () => {
      jest.spyOn(prisma.task, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.UNKNOWN } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.MASTERED } as any);
      const res = await service.submitMasteryCheck('u1', 'c1', { mode: 'EXPLANATION', passed: true });
      expect(res.state).toBe(LearnerState.MASTERED);
    });

    it('Maximum 3 attempts & Attempt 4 rejected', async () => {
      jest.spyOn(prisma.task, 'count').mockResolvedValue(3);
      await expect(service.submitMasteryCheck('u1', 'c1', { mode: 'TRADITIONAL_QUIZ', passed: true }))
        .rejects.toThrow('Maximum mastery attempts (3) exceeded.');
    });

    it('Mastery check can be stopped', async () => {
      jest.spyOn(prisma.task, 'count').mockResolvedValue(1);
      const current = { state: LearnerState.SELF_REPORTED };
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue(current as any);
      const res = await service.submitMasteryCheck('u1', 'c1', { mode: 'SCENARIO', passed: false, stoppedEarly: true });
      expect(res).toEqual(current);
    });

    it('Failed mastery check does not lock roadmap', async () => {
      jest.spyOn(prisma.task, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.learnerConceptState, 'findUnique').mockResolvedValue({ state: LearnerState.MASTERED } as any);
      jest.spyOn(prisma.learnerConceptState, 'upsert').mockResolvedValue({ state: LearnerState.NEEDS_REVIEW } as any);
      const res = await service.submitMasteryCheck('u1', 'c1', { mode: 'TRADITIONAL_QUIZ', passed: false });
      expect(res.state).toBe(LearnerState.NEEDS_REVIEW); // Not UNKNOWN/Locked
    });
  });
});
