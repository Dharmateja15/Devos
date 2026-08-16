import { Test, TestingModule } from '@nestjs/testing';
import { JourneysService } from './journeys.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('JourneysService', () => {
  let service: JourneysService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JourneysService,
        {
          provide: PrismaService,
          useValue: {
            journey: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<JourneysService>(JourneysService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('getJourney', () => {
    it('should calculate progress correctly based on tasks', async () => {
      jest.spyOn(prismaService.journey, 'findUnique').mockResolvedValue({
        id: 'j1',
        userId: 'u1',
        deletedAt: null,
        milestones: [
          {
            id: 'm1',
            tasks: [{ status: 'DONE' }, { status: 'TODO' }],
          },
          {
            id: 'm2',
            tasks: [{ status: 'DONE' }],
          },
        ],
      } as any);

      const journey = await service.getJourney('u1', 'j1');
      expect(journey.totalTasks).toBe(3);
      expect(journey.completedTasks).toBe(2);
      expect(journey.progress).toBe(67);
      expect(journey.completedMilestones).toBe(1);
    });

    it('should enforce authorization', async () => {
      jest.spyOn(prismaService.journey, 'findUnique').mockResolvedValue({
        id: 'j1',
        userId: 'u1', // Belongs to u1
        deletedAt: null,
        milestones: [],
      } as any);

      await expect(service.getJourney('u2', 'j1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
