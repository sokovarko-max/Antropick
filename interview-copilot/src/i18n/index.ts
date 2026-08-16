import en from "./en.json";
import ru from "./ru.json";

export type Locale = "en" | "ru";
export type TranslationKey = keyof typeof en;

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, ru };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/** No hardcoded UI copy in components — always go through t(). See CLAUDE.md. */
export function t(key: TranslationKey, locale: Locale = currentLocale): string {
  return DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? key;
}
