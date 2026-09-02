import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { t as translate, type Locale, type TranslationKey } from "./index";

export interface Translation {
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  locale: Locale;
}

/**
 * The only way components should read UI copy. Subscribing to the store's
 * locale is what makes a language switch actually repaint the UI — a plain
 * imported `t` cannot, because React has no way to know the language changed.
 */
export function useTranslation(): Translation {
  const locale = useSettingsStore((s) => s.locale);
  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string>) => translate(key, locale, vars),
    [locale],
  );
  return { t, locale };
}
