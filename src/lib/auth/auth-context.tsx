"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Inspector } from "@/types";
import { getStoredMockSession, signIn, signOut, type SignInInput } from "@/lib/api/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface AuthContextValue {
  inspector: Inspector | null;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (input: SignInInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [inspector, setInspector] = useState<Inspector | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isDemoMode = !isSupabaseConfigured();

  useEffect(() => {
    // Session lives in localStorage, unavailable during server render — this
    // client-only sync intentionally runs once after mount, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInspector(getStoredMockSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (input: SignInInput) => {
    const user = await signIn(input);
    setInspector(user);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setInspector(null);
  }, []);

  const value = useMemo(
    () => ({ inspector, isLoading, isDemoMode, login, logout }),
    [inspector, isLoading, isDemoMode, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
