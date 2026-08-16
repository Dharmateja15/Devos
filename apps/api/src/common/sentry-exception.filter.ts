import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'oldpassword',
  'newpassword',
  'jwt',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'apikey',
  'secret',
  'privatekey',
  'database_url',
  'redis_url',
];

/**
 * Sanitizes objects by masking sensitive keys (passwords, tokens, credentials, etc.)
 */
export function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);
  private sentryInitialized = false;

  constructor() {
    const dsn = process.env.SENTRY_DSN;
    if (dsn && dsn.trim()) {
      try {
        Sentry.init({
          dsn,
          environment:
            process.env.SENTRY_ENVIRONMENT ||
            process.env.NODE_ENV ||
            'development',
          tracesSampleRate: 0.1,
        });
        this.sentryInitialized = true;
        this.logger.log('Sentry error tracking initialized successfully.');
      } catch (err: any) {
        this.logger.warn(`Failed to initialize Sentry: ${err.message}`);
      }
    } else {
      this.logger.debug(
        'SENTRY_DSN not configured. Sentry tracking running in mock/disabled mode.',
      );
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isServerError = status >= 500;

    const safeUrl = request?.url || '';
    const safeMethod = request?.method || 'UNKNOWN';

    let message: string | object = 'Internal server error';
    let errorResponse: any = null;

    if (exception instanceof HttpException) {
      errorResponse = exception.getResponse();
      message =
        typeof errorResponse === 'string'
          ? errorResponse
          : errorResponse.message || exception.message;
    } else if (exception instanceof Error) {
      message = isServerError ? 'Internal server error' : exception.message;
    }

    if (isServerError) {
      const sanitizedBody = sanitizeData(request?.body);
      const sanitizedQuery = sanitizeData(request?.query);

      this.logger.error(
        `HTTP ${status} [${safeMethod} ${safeUrl}]: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );

      if (this.sentryInitialized) {
        Sentry.withScope((scope) => {
          scope.setExtra('path', safeUrl);
          scope.setExtra('method', safeMethod);
          scope.setExtra('statusCode', status);
          if (sanitizedQuery && Object.keys(sanitizedQuery).length > 0) {
            scope.setExtra('query', sanitizedQuery);
          }
          if (sanitizedBody && Object.keys(sanitizedBody).length > 0) {
            scope.setExtra('body', sanitizedBody);
          }

          Sentry.captureException(exception);
        });
      }
    }

    const payload = {
      statusCode: status,
      message,
      error:
        typeof errorResponse === 'object' && errorResponse !== null
          ? errorResponse.error ||
            (isServerError ? 'Internal Server Error' : undefined)
          : isServerError
            ? 'Internal Server Error'
            : undefined,
      timestamp: new Date().toISOString(),
      path: safeUrl,
    };

    response.status(status).json(payload);
  }
}
