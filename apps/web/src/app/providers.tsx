'use client';

import { AuthProvider } from '../context/AuthContext';
import { IntelligenceProvider } from '../context/IntelligenceContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <IntelligenceProvider>
        {children}
      </IntelligenceProvider>
    </AuthProvider>
  );
}
