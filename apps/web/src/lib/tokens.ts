const ACCESS_TOKEN_KEY = "ixoris-web-access-token";
const REFRESH_TOKEN_KEY = "ixoris-web-refresh-token";

// A production deployment behind its own domain should move these into an
// httpOnly cookie set by the API; plain localStorage is the pragmatic
// tradeoff for a same-origin-less SPA talking to a separate API host.
export function getAccessToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
