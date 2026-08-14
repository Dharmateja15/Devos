import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            session: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            }
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'test-access-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('Registration', () => {
    it('should register a valid user and return a token', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue({ id: 'uuid' } as any);
      jest.spyOn(prismaService.session, 'create').mockResolvedValue({ id: 'session-123' } as any);
      
      const result = await service.register({ email: 't@t.com', username: 't', password: 'pw' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).toMatch(/^session-123:[a-f0-9]+$/);
    });

    it('should securely hash password with argon2id and not store plaintext', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      const createSpy = jest.spyOn(prismaService.user, 'create').mockResolvedValue({ id: 'uuid' } as any);
      jest.spyOn(prismaService.session, 'create').mockResolvedValue({ id: 'session-123' } as any);
      
      await service.register({ email: 't@t.com', username: 't', password: 'plain-password' });
      const createArgs = createSpy.mock.calls[0][0];
      
      expect(createArgs.data.passwordHash).toBeDefined();
      expect(createArgs.data.passwordHash).not.toBe('plain-password');
      expect((createArgs.data as any).password).toBeUndefined();
    });
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const hash = await argon2.hash('correct-pw');
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue({
        id: 'uuid',
        passwordHash: hash,
      } as any);
      jest.spyOn(prismaService.session, 'create').mockResolvedValue({ id: 'session-123' } as any);

      const result = await service.login({ identity: 'test', password: 'correct-pw' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).toMatch(/^session-123:[a-f0-9]+$/);
    });

    it('should throw on invalid password', async () => {
      const hash = await argon2.hash('correct-pw');
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue({
        id: 'uuid',
        passwordHash: hash,
      } as any);

      await expect(service.login({ identity: 'test', password: 'wrong-pw' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Refresh & Session', () => {
    it('should rotate refresh token', async () => {
      const sessionId = 'session1';
      const tokenValue = 'random-bytes-value';
      const salt = await bcrypt.genSalt(10);
      const refreshTokenHash = await bcrypt.hash(tokenValue, salt);

      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue({
        id: sessionId,
        userId: 'uuid',
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 100000), // future
      } as any);

      jest.spyOn(prismaService.session, 'update').mockResolvedValue({} as any);

      const result = await service.refresh(`${sessionId}:${tokenValue}`);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(`${sessionId}:${tokenValue}`);
    });

    it('should fail if session expired', async () => {
      const sessionId = 'session1';
      const tokenValue = 'random-bytes-value';
      
      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue({
        id: sessionId,
        userId: 'uuid',
        refreshTokenHash: 'hash',
        expiresAt: new Date(Date.now() - 100000), // past
      } as any);

      await expect(service.refresh(`${sessionId}:${tokenValue}`))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
