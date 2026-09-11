import type en from "./dictionaries/en";

export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

/** Widens every literal leaf of T to `string` while preserving the nested key shape. */
type DeepStringify<T> = T extends string ? string : { [K in keyof T]: DeepStringify<T[K]> };

/**
 * English defines the canonical key shape; every other locale is
 * type-checked against this (via `satisfies Dictionary`) so a missing or
 * misspelled key fails at compile time — but leaves are widened to `string`
 * so each locale can hold its own translated text.
 */
export type Dictionary = DeepStringify<typeof en>;
