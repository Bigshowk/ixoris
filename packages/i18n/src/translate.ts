import en from "./dictionaries/en";
import fr from "./dictionaries/fr";
import { Dictionary, Locale } from "./types";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.fr;
}

/**
 * Dot-path lookup with `{{param}}` interpolation — for contexts without a
 * React hook (backend error/notification messages, CLI-ish output). Frontend
 * components should prefer next-intl's `useTranslations` fed by the same
 * dictionaries, not this function.
 */
export function t(locale: Locale, path: string, params?: Record<string, string | number>): string {
  const dict = getDictionary(locale);
  const value = path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], dict);

  if (typeof value !== "string") return path;
  if (!params) return value;

  return Object.entries(params).reduce((str, [key, val]) => str.split(`{{${key}}}`).join(String(val)), value);
}
