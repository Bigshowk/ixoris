export type ThemePreference = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

const THEME_KEY = "ixoris-web-theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function saveStoredTheme(pref: ThemePreference): void {
  window.localStorage.setItem(THEME_KEY, pref);
}

export function resolveEffectiveTheme(pref: ThemePreference): EffectiveTheme {
  if (pref !== "system") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Toggles Tailwind's `dark` class on <html> — tailwind.config.ts uses darkMode: "class". */
export function applyTheme(effective: EffectiveTheme): void {
  document.documentElement.classList.toggle("dark", effective === "dark");
}
