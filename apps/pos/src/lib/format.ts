import { formatCurrency, formatDate as formatDateIntl, Locale } from "@ixoris/i18n";

const LOCALE_KEY = "ixoris-pos-locale";

/** Same storage key/behavior as I18nProvider's getStoredLocale — read directly since these are plain functions, not hooks. */
function currentLocale(): Locale {
  if (typeof window === "undefined") return "fr";
  return window.localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "fr";
}

/** Company base currency — the fallback for amounts that don't carry their own currencyCode (cart lines, product prices — a Sale only gets a currencyCode once checked out). */
export const DEFAULT_CURRENCY = "XOF";

export function formatMoney(value: number, currencyCode: string = DEFAULT_CURRENCY): string {
  return formatCurrency(value, currencyCode, currentLocale());
}

export function formatDate(value: string | Date): string {
  return formatDateIntl(value, currentLocale());
}
