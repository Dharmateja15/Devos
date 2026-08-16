import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('MilestonesService', () => {
  let service: MilestonesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        {
          provide: PrismaService,
          useValue: {
            journey: {
              findUnique: jest.fn(),
            },
            milestone: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('createMilestone', () => {
    it('should forbid creating milestone in unauthorized journey', async () => {
      jest.spyOn(prismaService.journey, 'findUnique').mockResolvedValue({
        id: 'j1',
        userId: 'u1',
        deletedAt: null,
      } as any);

      await expect(
        service.createMilestone('u2', 'j1', { title: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMilestone', () => {
    it('should forbid getting unauthorized milestone', async () => {
      jest.spyOn(prismaService.milestone, 'findUnique').mockResolvedValue({
        id: 'm1',
        journey: { userId: 'u1' },
        deletedAt: null,
      } as any);

      await expect(service.getMilestone('u2', 'm1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
