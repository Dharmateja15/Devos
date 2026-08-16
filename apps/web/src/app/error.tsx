'use client';

import { useEffect } from 'react';
import { captureFrontendError } from '../lib/sentry';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    captureFrontendError(error);
  }, [error]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ef4444' }}>
        Something went wrong!
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        An unexpected application error occurred.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#2563eb',
          color: '#ffffff',
          borderRadius: '0.375rem',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Try again
      </button>
    </div>
  );
}
