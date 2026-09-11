"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, Locale, t as translate } from "@ixoris/i18n";
import { authApi } from "./auth-api";

const LOCALE_KEY = "ixoris-pos-locale";

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

/**
 * Lightweight i18n context built directly on `@ixoris/i18n`'s shared
 * dictionaries (also consumed by the API for bilingual notifications) rather
 * than next-intl's routing-based setup — this app has no public URL-based
 * locale switching need, just a per-user preference, so a custom context
 * avoids the [locale] segment/middleware machinery next-intl expects for its
 * full feature set while still keeping every string out of the components.
 */
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
