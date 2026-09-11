export interface DeliverySession {
  companyId: string;
  storeId: string;
  userId: string;
}

const SESSION_KEY = "ixoris-delivery-session";

export function getSession(): DeliverySession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as DeliverySession) : null;
}

export function saveSession(session: DeliverySession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
