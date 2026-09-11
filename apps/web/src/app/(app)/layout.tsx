"use client";

import { useCallback, useEffect, useState } from "react";
import { authApi, AuthUser } from "../../lib/auth-api";
import { getSession, clearSession, saveSession } from "../../lib/session";
import { LoginScreen } from "../../components/LoginScreen";
import { AppShell } from "../../components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadUser = useCallback(async () => {
    const session = getSession();
    if (!session) {
      setReady(true);
      return;
    }
    try {
      const me = await authApi.me();
      saveSession({ companyId: me.user.companyId ?? "", storeId: session.storeId, userId: me.user.id });
      setUser(me.user);
    } catch {
      clearSession();
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function handleLogout() {
    await authApi.logout();
    clearSession();
    setUser(null);
  }

  if (!ready) return null;

  if (!user) {
    return <LoginScreen onReady={loadUser} />;
  }

  return (
    <AppShell user={user} onLogout={handleLogout}>
      {children}
    </AppShell>
  );
}
