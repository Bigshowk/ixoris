export interface WebSession {
  companyId: string;
  storeId: string;
  userId: string;
}

const SESSION_KEY = "ixoris-web-session";

export function getSession(): WebSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as WebSession) : null;
}

export function saveSession(session: WebSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
