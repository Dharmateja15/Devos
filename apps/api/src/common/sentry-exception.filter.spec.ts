import { SentryExceptionFilter, sanitizeData } from './sentry-exception.filter';
import {
  BadRequestException,
  InternalServerErrorException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn((callback) => {
    const scope = { setExtra: jest.fn() };
    callback(scope);
  }),
}));

describe('SentryExceptionFilter & Data Sanitization', () => {
  let filter: SentryExceptionFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SENTRY_DSN;
    filter = new SentryExceptionFilter();
  });

  describe('sanitizeData', () => {
    it('should redact sensitive password, token, and credential fields', () => {
      const sensitiveInput = {
        username: 'alice',
        password: 'SuperSecretPassword123!',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        accessToken: 'gho_1234567890abcdef',
        refreshToken: 'rft_1234567890abcdef',
        cookie: 'session=123',
        nested: {
          apiKey: 'secret-key-99',
          normalField: 'hello',
        },
      };

      const sanitized = sanitizeData(sensitiveInput);

      expect(sanitized.username).toBe('alice');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.jwt).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.nested.apiKey).toBe('[REDACTED]');
      expect(sanitized.nested.normalField).toBe('hello');
    });

    it('should handle null, non-objects, and arrays safely', () => {
      expect(sanitizeData(null)).toBeNull();
      expect(sanitizeData('simple string')).toBe('simple string');
      expect(sanitizeData(12345)).toBe(12345);
      expect(sanitizeData([{ password: 'secret' }])).toEqual([
        { password: '[REDACTED]' },
      ]);
    });
  });

  describe('catch()', () => {
    it('should handle 4xx HTTP exceptions without creating 5xx error noise', () => {
      const mockResponse: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest: any = {
        url: '/api/v1/journeys/invalid-id',
        method: 'GET',
      };
      const mockHost: any = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      };

      const exception = new BadRequestException('Invalid ID format');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid ID format',
          path: '/api/v1/journeys/invalid-id',
        }),
      );
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('should handle 5xx server errors and report to Sentry when DSN is configured', () => {
      process.env.SENTRY_DSN = 'https://mock@sentry.io/12345';
      const activeFilter = new SentryExceptionFilter();

      const mockResponse: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest: any = {
        url: '/api/v1/journeys',
        method: 'POST',
        body: { title: 'New Journey', password: 'secretPassword' },
      };
      const mockHost: any = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      };

      const exception = new InternalServerErrorException('Database failure');

      activeFilter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database failure',
          error: 'Internal Server Error',
        }),
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    });

    it('should operate safely without throwing when Sentry is disabled/unconfigured', () => {
      delete process.env.SENTRY_DSN;
      const mockResponse: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest: any = {
        url: '/api/v1/test',
        method: 'GET',
      };
      const mockHost: any = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      };

      const unhandledError = new Error('Unexpected crash');

      filter.catch(unhandledError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
        }),
      );
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
