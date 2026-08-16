import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GitHubOAuthController } from './github-oauth.controller';
import { GitHubOAuthService } from './github-oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';
import {
  encryptToken,
  decryptToken,
  getEncryptionKey,
} from '../common/crypto.util';

describe('Phase 7.4.3 Correction — Authenticated GitHub OAuth Initiation & Token Security', () => {
  let controller: GitHubOAuthController;
  let service: GitHubOAuthService;

  const mockPrisma = {
    oAuthAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockRedisService = {
    setOAuthState: jest.fn(),
    getAndDeleteOAuthState: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GitHubOAuthController],
      providers: [
        GitHubOAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<GitHubOAuthController>(GitHubOAuthController);
    service = module.get<GitHubOAuthService>(GitHubOAuthService);
  });

  describe('1. Two-Step Authenticated OAuth Initiation', () => {
    it('1. GET /api/v1/auth/oauth/github returns JSON authorizationUrl for authenticated user', async () => {
      mockRedisService.setOAuthState.mockResolvedValue(undefined);

      const res = await controller.initiateOAuth({ id: 'u_authenticated_1' });

      expect(res).toHaveProperty('authorizationUrl');
      expect(res).toHaveProperty('url');
      expect(res.authorizationUrl).toContain(
        'https://github.com/login/oauth/authorize',
      );
      expect(res.authorizationUrl).toContain('client_id=');
      expect(res.authorizationUrl).toContain('scope=read:user');

      expect(res.authorizationUrl).toContain('state=');
    });

    it('2. Authorization URL does NOT contain JWT, accessToken, or refreshToken', async () => {
      mockRedisService.setOAuthState.mockResolvedValue(undefined);

      const res = await controller.initiateOAuth({ id: 'u_authenticated_1' });
      const url = res.authorizationUrl;

      expect(url).not.toContain('Bearer');
      expect(url).not.toContain('accessToken');
      expect(url).not.toContain('refreshToken');
      expect(url).not.toContain('jwt');
      expect(url).not.toContain('OAUTH_ENCRYPTION_SECRET');
    });

    it('3. Redis failure during initiation prevents authorization URL creation', async () => {
      mockRedisService.setOAuthState.mockRejectedValue(
        new Error('Redis cluster down'),
      );

      await expect(controller.initiateOAuth({ id: 'u1' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('4. State creation stores userId in Redis with 600-second TTL', async () => {
      mockRedisService.setOAuthState.mockResolvedValue(undefined);

      const state = await service.createState('user_devos_123');

      expect(typeof state).toBe('string');
      expect(state).toHaveLength(64);
      expect(mockRedisService.setOAuthState).toHaveBeenCalledWith(
        state,
        'user_devos_123',
        600,
      );
    });

    it('5. State can be consumed exactly once (single-use atomic Lua semantic)', async () => {
      mockRedisService.getAndDeleteOAuthState
        .mockResolvedValueOnce({ userId: 'u1' })
        .mockResolvedValueOnce(null);

      const firstCall = await service.consumeState('state_123');
      expect(firstCall).toBe('u1');

      const secondCall = await service.consumeState('state_123');
      expect(secondCall).toBeNull();
    });

    it('6. Consumed state cannot be replayed for another user', async () => {
      mockRedisService.getAndDeleteOAuthState.mockResolvedValue(null);

      const res = { redirect: jest.fn() } as any;
      await controller.callback('code123', 'replayed_state', res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/settings?error=oauth_failed'),
      );
    });
  });

  describe('2. Multi-Instance & Callback Behavior', () => {
    it('7. Simulates initiation on Instance A and callback on Instance B via shared Redis double', async () => {
      const sharedRedisStore = new Map<string, string>();

      mockRedisService.setOAuthState.mockImplementation(
        async (state: string, userId: string) => {
          sharedRedisStore.set(
            `oauth:github:state:${state}`,
            JSON.stringify({ userId }),
          );
        },
      );

      mockRedisService.getAndDeleteOAuthState.mockImplementation(
        async (state: string) => {
          const key = `oauth:github:state:${state}`;
          const val = sharedRedisStore.get(key);
          if (val) {
            sharedRedisStore.delete(key);
            return JSON.parse(val);
          }
          return null;
        },
      );

      const state = await service.createState('u_instance_a');
      expect(sharedRedisStore.has(`oauth:github:state:${state}`)).toBe(true);

      const consumedUserId = await service.consumeState(state);
      expect(consumedUserId).toBe('u_instance_a');
      expect(sharedRedisStore.has(`oauth:github:state:${state}`)).toBe(false);
    });

    it('8. Redis error during callback fails safely and redirects to safe error page', async () => {
      mockRedisService.getAndDeleteOAuthState.mockRejectedValue(
        new Error('Redis timeout'),
      );

      const res = { redirect: jest.fn() } as any;
      await controller.callback('code123', 'state_err', res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/settings?error=oauth_failed',
      );
    });
  });

  describe('3. Token Encryption & Security Regression Boundaries', () => {
    it('9. OAuth access token is STILL encrypted using AES-256-GCM before Prisma persistence', async () => {
      mockRedisService.getAndDeleteOAuthState.mockResolvedValue({
        userId: 'u1',
      });
      const rawToken = 'gho_secret_token_val_999';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: rawToken }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 7777, login: 'octocat' }),
      });

      mockPrisma.oAuthAccount.findFirst.mockResolvedValue(null);
      mockPrisma.oAuthAccount.upsert.mockResolvedValue({});

      await service.handleCallback('code123', 'state123');

      const upsertArgs = mockPrisma.oAuthAccount.upsert.mock.calls[0][0];
      const persistedToken = upsertArgs.create.accessToken;

      expect(persistedToken).not.toBe(rawToken);
      expect(persistedToken.startsWith('enc:')).toBe(true);
    });

    it('10. JWT_PRIVATE_KEY is NEVER used as OAuth encryption fallback', () => {
      const prevSecret = process.env.OAUTH_ENCRYPTION_SECRET;
      delete process.env.OAUTH_ENCRYPTION_SECRET;
      process.env.JWT_PRIVATE_KEY = 'jwt_key_that_must_never_be_used_for_oauth';
      process.env.NODE_ENV = 'production';

      expect(() => getEncryptionKey()).toThrow(
        'FATAL CONFIGURATION ERROR: OAUTH_ENCRYPTION_SECRET environment variable is missing.',
      );

      if (prevSecret) process.env.OAUTH_ENCRYPTION_SECRET = prevSecret;
      process.env.NODE_ENV = 'test';
    });

    it('11. Account takeover is prevented when GitHub ID is linked to another user', async () => {
      mockRedisService.getAndDeleteOAuthState.mockResolvedValue({
        userId: 'u1',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'gho_token' }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 7777, login: 'octocat' }),
      });

      mockPrisma.oAuthAccount.findFirst.mockResolvedValue({
        id: 'oa1',
        userId: 'u999',
        provider: 'GITHUB',
        providerId: '7777',
      });

      await expect(
        service.handleCallback('code123', 'state123'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
