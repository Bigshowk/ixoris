export type { Locale, Dictionary } from "./types";
export { LOCALES, DEFAULT_LOCALE } from "./types";
export { default as en } from "./dictionaries/en";
export { default as fr } from "./dictionaries/fr";
export { getDictionary, t } from "./translate";
export { formatCurrency, formatDate, formatDateTime, formatNumber } from "./format";
