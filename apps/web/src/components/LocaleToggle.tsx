"use client";

import { useI18n } from "../lib/i18n-context";

export function LocaleToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
      className="flex h-8 items-center justify-center rounded-md px-2 text-xs font-medium uppercase hover:bg-slate-200 dark:hover:bg-slate-800"
      title={locale === "fr" ? "Switch to English" : "Passer en français"}
    >
      {locale}
    </button>
  );
}
