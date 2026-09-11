"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, getStoredTheme, resolveEffectiveTheme, saveStoredTheme, ThemePreference } from "../lib/theme";
import { authApi } from "../lib/auth-api";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(resolveEffectiveTheme(stored));
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveEffectiveTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((pref: ThemePreference) => {
    setThemeState(pref);
    saveStoredTheme(pref);
    applyTheme(resolveEffectiveTheme(pref));
    authApi.updatePreferences({ themePreference: pref }).catch(() => {});
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
