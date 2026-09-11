import { Locale } from "./types";

function toIntlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "fr-FR";
}

/** Regional currency/date/number formatting — Intl handles XOF/KMF/EUR/USD natively as ISO 4217 codes. */
export function formatCurrency(amount: number, currencyCode: string, locale: Locale = "fr"): string {
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

export function formatDate(date: Date | string, locale: Locale = "fr"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(toIntlLocale(locale), { dateStyle: "short" }).format(value);
}

export function formatDateTime(date: Date | string, locale: Locale = "fr"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(toIntlLocale(locale), { dateStyle: "short", timeStyle: "short" }).format(value);
}

export function formatNumber(value: number, locale: Locale = "fr"): string {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(value);
}
