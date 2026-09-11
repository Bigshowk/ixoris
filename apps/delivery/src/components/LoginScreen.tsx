"use client";

import { FormEvent, useState } from "react";
import { authApi, AuthUser, StoreSummary } from "../lib/auth-api";
import { saveSession } from "../lib/session";
import { useI18n } from "../lib/i18n-context";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleToggle } from "./LocaleToggle";

export interface LoginScreenProps {
  onReady: () => void;
}

export function LoginScreen({ onReady }: LoginScreenProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stores, setStores] = useState<StoreSummary[]>([]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await authApi.login(email, password);
      const me = await authApi.me();

      if (me.stores.length === 0) {
        setError(t("auth.selectStore"));
        return;
      }
      if (me.stores.length === 1) {
        completeLogin(loggedInUser, me.stores[0].id);
        return;
      }
      setUser(loggedInUser);
      setStores(me.stores);
    } catch {
      setError(t("auth.loginError"));
    } finally {
      setLoading(false);
    }
  }

  function completeLogin(loggedInUser: AuthUser, storeId: string) {
    saveSession({ companyId: loggedInUser.companyId ?? "", storeId, userId: loggedInUser.id });
    onReady();
  }

  const corner = (
    <div className="absolute right-4 top-4 flex items-center gap-1 text-slate-500 dark:text-slate-400">
      <LocaleToggle />
      <ThemeToggle />
    </div>
  );

  if (user && stores.length > 1) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        {corner}
        <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("auth.selectStore")}</h1>
          {stores.map((store) => (
            <button
              key={store.id}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-900 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              onClick={() => completeLogin(user, store.id)}
            >
              {store.name} <span className="text-slate-500 dark:text-slate-400">({store.code})</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      {corner}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("delivery.appTitle")}</h1>
        <label className="block text-sm text-slate-600 dark:text-slate-300">
          {t("auth.email")}
          <input
            type="email"
            required
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-600 dark:text-slate-300">
          {t("auth.password")}
          <input
            type="password"
            required
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? t("auth.connecting") : t("auth.login")}
        </button>
      </form>
    </div>
  );
}
