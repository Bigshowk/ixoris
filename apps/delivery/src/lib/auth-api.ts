import { API_URL } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokens";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
  locale?: string | null;
  themePreference?: string | null;
  mfaEnabled?: boolean;
  mfaRequired?: boolean;
}

export type LoginResult = { mfaRequired: true; mfaToken: string } | { mfaRequired: false; user: AuthUser };

export interface StoreSummary {
  id: string;
  name: string;
  code: string;
}

export interface MeResponse {
  user: AuthUser;
  roles: { name: string; storeId: string | null; storeName: string | null }[];
  stores: StoreSummary[];
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Auth request ${path} failed with ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const result = await authFetch<
      { mfaRequired: true; mfaToken: string } | { mfaRequired: false; accessToken: string; refreshToken: string; user: AuthUser }
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (result.mfaRequired) return result;
    saveTokens(result.accessToken, result.refreshToken);
    return { mfaRequired: false, user: result.user };
  },

  /** Second step of login when the account has MFA enabled — exchanges the challenge for real tokens. */
  async verifyMfa(mfaToken: string, code: string): Promise<AuthUser> {
    const result = await authFetch<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ mfaToken, code }),
    });
    saveTokens(result.accessToken, result.refreshToken);
    return result.user;
  },

  me(): Promise<MeResponse> {
    const token = getAccessToken();
    return authFetch<MeResponse>("/auth/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },

  async refresh(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const result = await authFetch<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      saveTokens(result.accessToken, result.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await authFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => {});
    }
    clearTokens();
  },

  updatePreferences(prefs: { locale?: string; themePreference?: string }): Promise<AuthUser> {
    const token = getAccessToken();
    return authFetch<AuthUser>("/auth/preferences", {
      method: "PATCH",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(prefs),
    });
  },
};
