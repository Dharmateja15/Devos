'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loginApi, registerApi, refreshApi, logoutApi, getMeApi } from '../lib/api';

interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  user: any;
  setUser: (user: any) => void;
  stats: any;
  setStats: (stats: any) => void;
  loading: boolean;
  login: (identity: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const fetchProfile = useCallback(async (token: string) => {
    try {
      const data = await getMeApi(token);
      setUser(data.user);
      setStats(data.stats);
      return data;
    } catch (e) {
      setUser(null);
      setStats(null);
      throw e;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await refreshApi();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        await fetchProfile(data.accessToken);
        return data.accessToken;
      }
      setAccessToken(null);
      setUser(null);
      setStats(null);
      return null;
    } catch (e) {
      setAccessToken(null);
      setUser(null);
      setStats(null);
      return null;
    }
  }, [fetchProfile]);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        await refresh();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    initAuth();
    return () => {
      isMounted = false;
    };
  }, [refresh]);

  const login = async (identity: string, password: string) => {
    const data = await loginApi({ identity, password });
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      await fetchProfile(data.accessToken);
    }
  };

  const register = async (email: string, username: string, password: string) => {
    const data = await registerApi({ email, username, password });
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      await fetchProfile(data.accessToken);
    }
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      console.error('Logout request failed', e);
    } finally {
      setAccessToken(null);
      setUser(null);
      setStats(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        setAccessToken,
        user,
        setUser,
        stats,
        setStats,
        loading,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
