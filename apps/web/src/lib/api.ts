import { API_URL } from "./config";
import { getSession } from "./session";
import { authApi } from "./auth-api";
import { getAccessToken } from "./tokens";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const session = getSession();
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (session) headers["x-store-id"] = session.storeId;
  return headers;
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...options, headers: buildHeaders(options.headers as Record<string, string>) });
}

/**
 * Generic authenticated fetch shared by every back-office module page.
 * Retries once after a silent token refresh if the access token expired mid-session.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401) {
    const refreshed = await authApi.refresh();
    if (refreshed) res = await rawFetch(path, options);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || `Request to ${path} failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** For PDF/CSV downloads: the API requires a Bearer token, so a plain <a href> can't carry it — fetch as a blob and open it instead. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  let res = await rawFetch(path, {});
  if (res.status === 401) {
    const refreshed = await authApi.refresh();
    if (refreshed) res = await rawFetch(path, {});
  }
  if (!res.ok) throw new ApiError(res.status, `Request to ${path} failed with ${res.status}`);
  return res.blob();
}

export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
