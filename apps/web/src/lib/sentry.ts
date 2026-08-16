import * as Sentry from '@sentry/react';

let isSentryInitialized = false;

export function initFrontendSentry(): void {
  if (typeof window === 'undefined' || isSentryInitialized) {
    return;
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn && dsn.trim()) {
    try {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
      });
      isSentryInitialized = true;
    } catch {
      // Telemetry fallback without throwing
    }
  }
}

export function captureFrontendError(error: Error | unknown, errorInfo?: any): void {
  initFrontendSentry();
  if (isSentryInitialized) {
    Sentry.withScope((scope) => {
      if (errorInfo) {
        scope.setExtra('componentStack', errorInfo.componentStack);
      }
      Sentry.captureException(error);
    });
  }
}
