'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refresh, session } from './api';

export interface Membership {
  businessId: string; tradeName: string; logoUrl: string | null; currency: string;
  businessType?: string | null; category?: string | null;
  businessModel?: 'PRODUCTS' | 'SERVICES'; serviceProfile?: string | null;
  roleKey: string; roleName: string; permissions: string[];
  brandColors?: { primary: string; accent: string; paletteId?: string } | null;
}
export interface User { id: string; email: string; fullName: string; phone: string | null; socialLinks?: Record<string, string>; twoFactorEnabled: boolean; tutorialsSeen?: string[] }

interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: User | null;
  businesses: Membership[];
  current: Membership | null;
  can: (perm: string) => boolean;
  login: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  switchBusiness: (id: string) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<Membership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const me = await api<{ user: User; businesses: Membership[] }>('/auth/me', { noBusiness: true });
    setUser(me.user);
    setBusinesses(me.businesses);
    const stored = session.storedBusiness();
    const pick = me.businesses.find((b) => b.businessId === stored) ?? me.businesses[0] ?? null;
    session.setBusiness(pick?.businessId ?? null);
    setCurrentId(pick?.businessId ?? null);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    session.onUnauthorized(() => { session.setToken(null); setStatus('anonymous'); setUser(null); });
    (async () => {
      if (await refresh()) {
        try { await load(); return; } catch { /* sesión inválida */ }
      }
      setStatus('anonymous');
    })();
  }, [load]);

  const value = useMemo<AuthState>(() => {
    const current = businesses.find((b) => b.businessId === currentId) ?? null;
    return {
      status, user, businesses, current,
      can: (p) => !!current?.permissions.includes(p),
      login: async (token) => { session.setToken(token); await load(); },
      logout: async () => {
        await api('/auth/logout', { method: 'POST', noBusiness: true }).catch(() => undefined);
        session.setToken(null); session.setBusiness(null);
        setUser(null); setBusinesses([]); setStatus('anonymous');
      },
      reload: load,
      switchBusiness: (id) => { session.setBusiness(id); setCurrentId(id); },
    };
  }, [status, user, businesses, currentId, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
