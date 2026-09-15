/**
 * Central HTTP client for the real FastAPI backend.
 *
 * Every function in lib/api/*.ts checks `isApiConfigured()` first and
 * falls back to the existing mock implementation when it's false — the
 * frontend must keep working with zero backend configured (see
 * docs/API_CONTRACT.md §1). This module is only reached once
 * NEXT_PUBLIC_API_BASE_URL is set.
 */
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ApiErrorBody } from "@/types/api";

export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = getSupabaseClient();
  if (!supabase) return {};
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const errorBody = body as ApiErrorBody | undefined;
    throw new ApiError(
      res.status,
      errorBody?.error?.code ?? "UNKNOWN_ERROR",
      errorBody?.error?.message ?? `Request failed with status ${res.status}`,
      errorBody?.error?.details
    );
  }

  return body as T;
}

function url(path: string): string {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  return `${base}${path}`;
}

export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await fetch(url(path + (qs === "?" ? "" : qs)), {
    headers: { ...(await authHeader()) },
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(url(path), {
    method: "DELETE",
    headers: { ...(await authHeader()) },
  });
  return handleResponse<T>(res);
}

/** multipart/form-data POST — never set Content-Type manually, the
 * browser must supply the multipart boundary. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { ...(await authHeader()) },
    body: form,
  });
  return handleResponse<T>(res);
}

/** Converts a `data:...;base64,...` URL back into a Blob for upload.
 * Prefer passing the original File when one is available — this exists
 * for draft images that only carry a data URL. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
