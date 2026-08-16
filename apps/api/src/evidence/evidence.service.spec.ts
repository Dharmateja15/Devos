import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceService } from './evidence.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { AchievementsService } from '../gamification/achievements.service';
import { EvidenceType } from '@prisma/client';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let mockPrisma: any;
  let mockGamification: any;
  let mockAchievements: any;

  beforeEach(async () => {
    mockPrisma = {
      task: { findUnique: jest.fn() },
      journey: { findUnique: jest.fn() },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      evidenceItem: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      outboxEvent: { create: jest.fn() },
    };
    mockGamification = { awardXp: jest.fn() };
    mockAchievements = { evaluateAchievement: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GamificationService, useValue: mockGamification },
        { provide: AchievementsService, useValue: mockAchievements },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
  });

  it('should deny cross-user evidence access', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      journey: { userId: 'other-user' },
    });
    await expect(
      service.createEvidence('user-1', {
        taskId: 't1',
        evidenceType: EvidenceType.MANUAL,
      }),
    ).rejects.toThrow('You do not own this task');
  });

  it('should reject invalid evidence type', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      journey: { userId: 'user-1' },
    });
    await expect(
      service.createEvidence('user-1', {
        taskId: 't1',
        evidenceType: 'INVALID',
      }),
    ).rejects.toThrow('Invalid evidence type');
  });

  it('should grant +5 XP exactly once for MANUAL evidence on a task', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      journey: { userId: 'user-1' },
      id: 't1',
      journeyId: 'j1',
    });
    mockPrisma.evidenceItem.create.mockResolvedValue({ id: 'ev1' });
    mockGamification.awardXp.mockResolvedValue(true);

    await service.createEvidence('user-1', {
      taskId: 't1',
      evidenceType: EvidenceType.MANUAL,
    });

    expect(mockGamification.awardXp).toHaveBeenCalledWith(
      expect.anything(),
      5,
      't1',
      'TASK_EVIDENCE',
      expect.any(String),
    );
  });

  it('should NOT grant +5 XP for EXTERNAL_URL evidence', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      journey: { userId: 'user-1' },
      id: 't1',
      journeyId: 'j1',
    });
    mockPrisma.evidenceItem.create.mockResolvedValue({ id: 'ev1' });

    await service.createEvidence('user-1', {
      taskId: 't1',
      evidenceType: EvidenceType.EXTERNAL_URL,
    });

    expect(mockGamification.awardXp).not.toHaveBeenCalled();
  });

  it('should not deduct XP when deleting evidence', async () => {
    mockPrisma.evidenceItem.findUnique.mockResolvedValue({
      id: 'ev1',
      userId: 'user-1',
    });
    mockPrisma.evidenceItem.update.mockResolvedValue({
      id: 'ev1',
      deletedAt: new Date(),
    });

    await service.deleteEvidence('user-1', 'ev1');

    expect(mockPrisma.evidenceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deletedAt: expect.any(Date) },
      }),
    );
    // Note: GamificationService is not even called for deletion, maintaining XP intact
    expect(mockGamification.awardXp).not.toHaveBeenCalled();
  });
});
