"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, Locale, t as translate } from "@ixoris/i18n";
import { authApi } from "./auth-api";

const LOCALE_KEY = "ixoris-web-locale";

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return window.localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "fr";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Same lightweight context as apps/pos/apps/delivery, built on the shared @ixoris/i18n dictionaries. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_KEY, next);
    authApi.updatePreferences({ locale: next }).catch(() => {
      // Best-effort — the local preference already applied instantly regardless of server sync.
    });
  }, []);

  const t = useCallback((path: string, params?: Record<string, string | number>) => translate(locale, path, params), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
