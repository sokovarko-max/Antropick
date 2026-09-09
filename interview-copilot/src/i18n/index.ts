import en from "./en.json";
import ru from "./ru.json";

export type Locale = "en" | "ru";
export type TranslationKey = keyof typeof en;

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, ru };

/**
 * Pure lookup — the locale is always passed in explicitly.
 *
 * There used to be a module-level `currentLocale` here with a `setLocale`
 * setter. That is exactly why switching to Russian did nothing: the settings
 * store never called the setter, and even if it had, a module variable is
 * invisible to React so nothing would re-render. Components must go through
 * `useTranslation()`, which reads the locale from the store and therefore
 * re-renders when it changes.
 */
export function t(
  key: TranslationKey,
  locale: Locale,
  vars?: Record<string, string>,
): string {
  const template = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? key;
  if (!vars) return template;
  // Vendor names and console URLs differ per provider, so error copy is
  // written once with placeholders rather than duplicated per vendor.
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}
