"use client";

/**
 * Auth service layer. Wraps Supabase Auth when credentials are configured;
 * otherwise falls back to a mock session so the UI is fully demonstrable
 * without a backend. See lib/auth/auth-context.tsx for the consuming hook.
 */
import type { Inspector } from "@/types";
import { CURRENT_INSPECTOR } from "@/lib/mock/inspectors";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const SESSION_KEY = "thinksphere.mock.session.v1";

export interface SignInInput {
  email: string;
  password: string;
}

export async function signIn(input: SignInInput): Promise<Inspector> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase!.auth.signInWithPassword(input);
    if (error) throw error;
    return {
      id: data.user?.id ?? CURRENT_INSPECTOR.id,
      name: data.user?.user_metadata?.full_name ?? input.email,
      email: input.email,
      role: "Inspector",
    };
  }

  // Demo/mock mode: any non-empty credentials succeed.
  if (!input.email || !input.password) {
    throw new Error("Email and password are required.");
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(CURRENT_INSPECTOR));
  }
  return delay(CURRENT_INSPECTOR);
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    await supabase!.auth.signOut();
    return;
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
  return delay(undefined, 150);
}

export function getStoredMockSession(): Inspector | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Inspector) : null;
  } catch {
    return null;
  }
}
