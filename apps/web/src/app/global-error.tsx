'use client';

import { useEffect } from 'react';
import { captureFrontendError } from '../lib/sentry';

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    captureFrontendError(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ef4444' }}>
            Application Error
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            A critical application error occurred.
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
            Reload App
          </button>
        </div>
      </body>
    </html>
  );
}
