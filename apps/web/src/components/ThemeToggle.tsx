"use client";

import { useTheme } from "./ThemeProvider";
import { ThemePreference } from "../lib/theme";
import { useI18n } from "../lib/i18n-context";

const CYCLE: ThemePreference[] = ["system", "light", "dark"];
const ICON: Record<ThemePreference, string> = { system: "🖥️", light: "☀️", dark: "🌙" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={t(`theme.${theme}`)}
      className="flex h-8 w-8 items-center justify-center rounded-md text-sm hover:bg-slate-200 dark:hover:bg-slate-800"
    >
      {ICON[theme]}
    </button>
  );
}
