import { Test, TestingModule } from '@nestjs/testing';
import {
  ValidationPipe,
  BadRequestException,
  Controller,
  Get,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerException,
} from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RegisterDto, LoginDto } from '../auth/auth.controller';
import { ExecuteCsvDto } from '../journeys/import-csv.controller';
import { ImportRoadmapDto } from '../roadmap/dto/import-roadmap.dto';
import { UpdateMappingDto } from '../roadmap/dto/update-mapping.dto';
import { GoalChangeImpactRequestDto } from '../roadmap/dto/roadmap-intelligence.dto';
import { SubmitGitHubRepoDto } from '../evidence/dto/github-evidence.dto';
import { validate } from 'class-validator';
import helmet from 'helmet';

@Controller('test-throttled')
class TestThrottledController {
  @Get()
  getTest() {
    return { ok: true };
  }
}

describe('Phase 1A — API Security Wrapper (Throttling, Helmet & ValidationPipe Final Audit)', () => {
  describe('1. Rate Limiting Behavior & 429 Response Enforcement', () => {
    it('1. AppModule compiles cleanly and exports ThrottlerModule', async () => {
      const appModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      expect(appModule).toBeDefined();
      expect(appModule.get(ThrottlerModule)).toBeDefined();
    });

    it('2. ThrottlerGuard allows requests below limit and throws ThrottlerException (429) when limit is exceeded', async () => {
      const testModule: TestingModule = await Test.createTestingModule({
        imports: [
          ThrottlerModule.forRoot([
            {
              name: 'strict',
              ttl: 60000,
              limit: 2, // Strict limit of 2 requests for testing
            },
          ]),
        ],
        controllers: [TestThrottledController],
        providers: [
          ThrottlerGuard,
          {
            provide: APP_GUARD,
            useExisting: ThrottlerGuard,
          },
        ],
      }).compile();

      const app = testModule.createNestApplication();
      await app.init();

      const guard = testModule.get(ThrottlerGuard);
      const handler = () => ({ ok: true });

      const mockExecutionContext = (ip: string) =>
        ({
          getHandler: () => handler,
          getClass: () => TestThrottledController,
          switchToHttp: () => ({
            getRequest: () => ({
              headers: {},
              ip,
              method: 'GET',
              url: '/test-throttled',
            }),
            getResponse: () => ({
              header: jest.fn(),
              setHeader: jest.fn(),
            }),
          }),
        }) as any;

      // Request 1: Allowed
      const canProceed1 = await guard.canActivate(
        mockExecutionContext('127.0.0.1'),
      );
      expect(canProceed1).toBe(true);

      // Request 2: Allowed
      const canProceed2 = await guard.canActivate(
        mockExecutionContext('127.0.0.1'),
      );
      expect(canProceed2).toBe(true);

      // Request 3: Exceeds limit -> throws ThrottlerException (HTTP 429)
      await expect(
        guard.canActivate(mockExecutionContext('127.0.0.1')),
      ).rejects.toThrow(ThrottlerException);

      await app.close();
    });
  });

  describe('2. Helmet Security Response Headers Verification', () => {
    it('3. Helmet middleware sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and X-DNS-Prefetch-Control', () => {
      const helmetMiddleware = helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      });

      const req: any = { headers: {} };
      const resHeaders: Record<string, string> = {};
      const res: any = {
        setHeader: jest.fn((key, val) => {
          resHeaders[key.toLowerCase()] = val;
        }),
        removeHeader: jest.fn(),
      };
      const next = jest.fn();

      helmetMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalled();
      expect(resHeaders['x-content-type-options']).toBe('nosniff');
      expect(resHeaders['x-frame-options']).toBe('SAMEORIGIN');
      expect(resHeaders['referrer-policy']).toBe('no-referrer');
      expect(resHeaders['x-dns-prefetch-control']).toBe('off');
    });
  });

  describe('3. ValidationPipe Endpoint Regression Suite', () => {
    let validationPipe: ValidationPipe;

    beforeEach(() => {
      validationPipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
    });

    it('4. Auth Login: Valid payload accepted, unknown property rejected', async () => {
      const validPayload = {
        identity: 'alice@devos.io',
        password: 'secure_password',
      };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: LoginDto,
      });
      expect(res).toEqual(validPayload);

      const invalidPayload = { ...validPayload, unexpectedExtraField: 'hack' };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: LoginDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('5. Auth Register: Valid payload accepted, unknown property rejected', async () => {
      const validPayload = {
        email: 'user@devos.io',
        username: 'devos_user',
        password: 'secure_password_123',
      };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: RegisterDto,
      });
      expect(res).toEqual(validPayload);

      const invalidPayload = { ...validPayload, role: 'ADMIN' };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: RegisterDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. CSV Execute: Valid previewToken accepted, unknown property rejected', async () => {
      const validPayload = { previewToken: 'token_abc123' };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: ExecuteCsvDto,
      });
      expect(res).toEqual(validPayload);

      const invalidPayload = {
        previewToken: 'token_abc123',
        executeFlag: 'override',
      };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: ExecuteCsvDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. GitHub Evidence: Valid repoUrl accepted, unknown property rejected', async () => {
      const validPayload = {
        repoUrl: 'https://github.com/org/repo',
        branch: 'main',
      };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: SubmitGitHubRepoDto,
      });
      expect(res.repoUrl).toBe(validPayload.repoUrl);

      const invalidPayload = { ...validPayload, maliciousInject: 'yes' };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: SubmitGitHubRepoDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. Roadmap Import: Valid import payload accepted, unknown property rejected', async () => {
      const validPayload = {
        sourceType: 'CSV',
        input: 'title,milestone\ntask1,m1',
      };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: ImportRoadmapDto,
      });
      expect(res.sourceType).toBe('CSV');

      const invalidPayload = { ...validPayload, unapprovedProperty: 999 };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: ImportRoadmapDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('9. Roadmap Mapping: Valid mapping payload accepted, unknown property rejected', async () => {
      const validPayload = {
        mappingStatus: 'USER_CONFIRMED',
        confidenceScore: 0.95,
      };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: UpdateMappingDto,
      });
      expect(res.mappingStatus).toBe('USER_CONFIRMED');

      const invalidPayload = { ...validPayload, bogusKey: 'error' };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: UpdateMappingDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('10. Roadmap Intelligence: Valid goal change payload accepted, unknown property rejected', async () => {
      const validPayload = {
        targetPriority: 'PRIMARY',
        targetStatus: 'ACTIVE',
      };
      const res = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: GoalChangeImpactRequestDto,
      });
      expect(res.targetPriority).toBe('PRIMARY');

      const invalidPayload = { ...validPayload, extraField: 'invalid' };
      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: GoalChangeImpactRequestDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
