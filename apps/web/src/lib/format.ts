import { formatCurrency, formatDate as formatDateIntl, formatNumber as formatNumberIntl, Locale } from "@ixoris/i18n";

const LOCALE_KEY = "ixoris-web-locale";

/** Same storage key/behavior as I18nProvider's getStoredLocale — read directly since these are plain functions, not hooks. */
function currentLocale(): Locale {
  if (typeof window === "undefined") return "fr";
  return window.localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "fr";
}

/** Company base currency — the fallback for records that don't carry their own currencyCode. */
export const DEFAULT_CURRENCY = "XOF";

/** Formats a monetary amount using Intl's currency rules (correct decimals per ISO 4217) in the active locale. Pass the record's own currencyCode when available. */
export function formatXOF(value: number | string, currencyCode: string = DEFAULT_CURRENCY): string {
  const n = typeof value === "string" ? Number(value) : value;
  return formatCurrency(n, currencyCode, currentLocale());
}

export function formatDate(value: string | Date): string {
  return formatDateIntl(value, currentLocale());
}

export function formatNumber(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return formatNumberIntl(n, currentLocale());
}
