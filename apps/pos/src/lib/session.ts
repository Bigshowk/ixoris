export interface PosSession {
  companyId: string;
  storeId: string;
  userId: string;
  registerId?: string;
}

const SESSION_KEY = "ixoris-pos-session";
const DEVICE_KEY = "ixoris-pos-device-id";

export function getSession(): PosSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as PosSession) : null;
}

export function saveSession(session: PosSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

/** Stable per-device identifier, used to attribute a Cart to the terminal that started it. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
