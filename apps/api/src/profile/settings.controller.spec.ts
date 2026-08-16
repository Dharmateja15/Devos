import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService, isValidHttpUrl } from './settings.service';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsController Validation & Allowlist Security (Phase 7.4.3 Integration Pass)', () => {
  let settingsController: SettingsController;
  let settingsService: SettingsService;
  let profileController: ProfileController;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    publicProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    oAuthAccount: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    xpLedger: {
      findFirst: jest.fn(),
    },
    streak: {
      findFirst: jest.fn(),
    },
    userAchievement: {
      findMany: jest.fn(),
    },
    journey: {
      findMany: jest.fn(),
    },
    evidenceItem: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController, ProfileController],
      providers: [
        SettingsService,
        ProfileService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    settingsController = module.get<SettingsController>(SettingsController);
    settingsService = module.get<SettingsService>(SettingsService);
    profileController = module.get<ProfileController>(ProfileController);
  });

  describe('Section 1: Social Links URL Safety Validation', () => {
    it('1. Valid HTTPS URL accepted', () => {
      expect(isValidHttpUrl('https://github.com/example')).toBe(true);
    });

    it('2. Valid HTTP URL accepted', () => {
      expect(isValidHttpUrl('http://example.com')).toBe(true);
    });

    it('3. javascript: URL rejected', () => {
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    });

    it('4. ftp:// URL rejected', () => {
      expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    });

    it('5. Malformed URL rejected', () => {
      expect(isValidHttpUrl('not-a-url')).toBe(false);
    });

    it('6. Arbitrary non-URL string rejected', () => {
      expect(isValidHttpUrl('some arbitrary string')).toBe(false);
    });

    it('7. Multiple valid social URLs accepted via updateProfile', async () => {
      mockPrisma.publicProfile.upsert.mockResolvedValue({
        isPublic: true,
        headline: null,
        bio: null,
        socialLinks: {
          github: 'https://github.com/alexdev',
          linkedin: 'https://linkedin.com/in/alexdev',
        },
      });

      const res = await settingsController.updateProfile(
        { id: 'u1' },
        {
          socialLinks: {
            github: 'https://github.com/alexdev',
            linkedin: 'https://linkedin.com/in/alexdev',
          },
        },
      );

      expect(res.profile.socialLinks).toEqual({
        github: 'https://github.com/alexdev',
        linkedin: 'https://linkedin.com/in/alexdev',
      });
    });

    it('8. Mixed valid/invalid values rejected via updateProfile', async () => {
      await expect(
        settingsController.updateProfile(
          { id: 'u1' },
          {
            socialLinks: {
              github: 'https://github.com/alexdev',
              malicious: 'javascript:alert(1)',
            },
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Section 2: Account Request Field Allowlist', () => {
    it('9. displayName accepted', async () => {
      mockPrisma.user.update.mockResolvedValue({
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
      });
      const res = await settingsController.updateAccount(
        { id: 'u1' },
        { displayName: 'Alice' },
      );
      expect(res.account.displayName).toBe('Alice');
    });

    it('10. username accepted', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
      });
      const res = await settingsController.updateAccount(
        { id: 'u1' },
        { username: 'alice' },
      );
      expect(res.account.username).toBe('alice');
    });

    it('11. avatarUrl accepted', async () => {
      mockPrisma.user.update.mockResolvedValue({
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: 'https://example.com/pic.png',
      });
      const res = await settingsController.updateAccount(
        { id: 'u1' },
        { avatarUrl: 'https://example.com/pic.png' },
      );
      expect(res.account.avatarUrl).toBe('https://example.com/pic.png');
    });

    it('12. unknown field rejected', async () => {
      await expect(
        settingsController.updateAccount({ id: 'u1' }, {
          someInternalField: 'val',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('13. role rejected', async () => {
      await expect(
        settingsController.updateAccount({ id: 'u1' }, {
          role: 'ADMIN',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('14. email rejected', async () => {
      await expect(
        settingsController.updateAccount({ id: 'u1' }, {
          email: 'attacker@example.com',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('15. timezone rejected', async () => {
      await expect(
        settingsController.updateAccount({ id: 'u1' }, {
          timezone: 'UTC',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('16. passwordHash rejected', async () => {
      await expect(
        settingsController.updateAccount({ id: 'u1' }, {
          passwordHash: 'hacked_hash',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Section 3: Profile Request Field Allowlist', () => {
    it('17. isPublic accepted', async () => {
      mockPrisma.publicProfile.upsert.mockResolvedValue({
        isPublic: true,
        headline: null,
        bio: null,
        socialLinks: {},
      });
      const res = await settingsController.updateProfile(
        { id: 'u1' },
        { isPublic: true },
      );
      expect(res.profile.isPublic).toBe(true);
    });

    it('18. headline accepted', async () => {
      mockPrisma.publicProfile.upsert.mockResolvedValue({
        isPublic: false,
        headline: 'Dev',
        bio: null,
        socialLinks: {},
      });
      const res = await settingsController.updateProfile(
        { id: 'u1' },
        { headline: 'Dev' },
      );
      expect(res.profile.headline).toBe('Dev');
    });

    it('19. bio accepted', async () => {
      mockPrisma.publicProfile.upsert.mockResolvedValue({
        isPublic: false,
        headline: null,
        bio: 'Hello',
        socialLinks: {},
      });
      const res = await settingsController.updateProfile(
        { id: 'u1' },
        { bio: 'Hello' },
      );
      expect(res.profile.bio).toBe('Hello');
    });

    it('20. socialLinks accepted', async () => {
      mockPrisma.publicProfile.upsert.mockResolvedValue({
        isPublic: false,
        headline: null,
        bio: null,
        socialLinks: { x: 'https://x.com/a' },
      });
      const res = await settingsController.updateProfile(
        { id: 'u1' },
        { socialLinks: { x: 'https://x.com/a' } },
      );
      expect(res.profile.socialLinks).toEqual({ x: 'https://x.com/a' });
    });

    it('21. unknown field rejected', async () => {
      await expect(
        settingsController.updateProfile({ id: 'u1' }, {
          someInternalField: 'val',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('22. totalXp rejected', async () => {
      await expect(
        settingsController.updateProfile({ id: 'u1' }, {
          totalXp: 999999,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('23. viewCount rejected', async () => {
      await expect(
        settingsController.updateProfile({ id: 'u1' }, {
          viewCount: 999999,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('24. featuredJourneyIds rejected', async () => {
      await expect(
        settingsController.updateProfile({ id: 'u1' }, {
          featuredJourneyIds: ['j1'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('25. userId rejected', async () => {
      await expect(
        settingsController.updateProfile({ id: 'u1' }, {
          userId: 'u999',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Section 4: Disconnect GitHub API Security (Phase 7.4.3)', () => {
    it("26. DELETE /api/v1/me/github deletes current user's GitHub OAuthAccount", async () => {
      mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });

      const res = await settingsController.disconnectGithub({ id: 'u1' });
      expect(res).toEqual({ success: true });

      expect(mockPrisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          provider: 'GITHUB',
        },
      });
    });

    it('27. DELETE /api/v1/me/github only targets current user ID', async () => {
      mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });

      await settingsController.disconnectGithub({ id: 'user_target_456' });

      const callWhere =
        mockPrisma.oAuthAccount.deleteMany.mock.calls[0][0].where;
      expect(callWhere.userId).toBe('user_target_456');
    });

    it('28. Disconnecting an already disconnected account succeeds safely (idempotent)', async () => {
      mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 0 });

      const res = await settingsController.disconnectGithub({ id: 'u1' });
      expect(res).toEqual({ success: true });
    });

    it('29. Disconnecting GitHub DOES NOT delete EvidenceItem records', async () => {
      mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });

      await settingsController.disconnectGithub({ id: 'u1' });
      expect(mockPrisma.evidenceItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Section 5: Security & Privacy Regression Protection', () => {
    it('GET /api/v1/me/settings returns own account, profile, and read-only github status without exposing OAuth tokens', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        displayName: 'A',
        username: 'a',
        avatarUrl: null,
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue(null);
      mockPrisma.oAuthAccount.findFirst.mockResolvedValue({
        id: 'oa1',
        provider: 'GITHUB',
        accessToken: 'SECRET_TOKEN',
        refreshToken: 'SECRET_REFRESH',
      });

      const res = (await settingsController.getSettings({ id: 'u1' })) as any;
      expect(res.github.connected).toBe(true);
      expect(res.accessToken).toBeUndefined();
      expect(res.refreshToken).toBeUndefined();
    });

    it('Duplicate username throws ConflictException', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        username: 'taken',
      });
      await expect(
        settingsController.updateAccount({ id: 'u1' }, { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('isPublic=false causes public profile GET /api/v1/p/:username to return 404', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'privatetest',
      });
      mockPrisma.publicProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        isPublic: false,
      });

      await expect(
        profileController.getPublicProfile('privatetest'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
