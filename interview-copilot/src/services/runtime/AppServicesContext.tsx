import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildAppServices } from "./AppServices";
import { AppServicesContext } from "./useAppServices";
import { useSettingsStore } from "@/stores/settingsStore";
import { apiKeyStorageKey, secureStoreGet } from "@/services/security/secureStore";

export function AppServicesProvider({ children }: { children: ReactNode }) {
  const demoMode = useSettingsStore((s) => s.demoMode);
  const providerId = useSettingsStore((s) => s.aiProvider);
  const apiKeyPresent = useSettingsStore((s) => s.apiKeyPresent[s.aiProvider]);
  const setApiKeyPresent = useSettingsStore((s) => s.setApiKeyPresent);
  // The real key is fetched from OS secure storage just-in-time and held only
  // in this component's memory — never in Zustand persisted state,
  // localStorage, or logs (see docs/security.md).
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The keychain is asked every time, and `apiKeyPresent` is treated as a
    // cache of the answer rather than a gate on the question. Skipping the
    // lookup when the flag was false meant that any way the flag could go
    // stale — a settings file restored without it, a build whose credential
    // store lost the key, a persist migration — left a perfectly good stored
    // key unread and the app locked in demo mode with no way out from the UI.
    secureStoreGet(apiKeyStorageKey(providerId))
      .then((key) => {
        if (cancelled) return;
        setApiKey(key);
        if (Boolean(key) !== apiKeyPresent) setApiKeyPresent(providerId, Boolean(key));
      })
      .catch(() => {
        // A store that cannot be read is the same as having no key: fall back
        // to demo answers rather than leaving the app in a half-built state.
        if (!cancelled) setApiKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, apiKeyPresent, setApiKeyPresent]);

  const services = useMemo(
    () => buildAppServices({ demoMode, providerId, apiKey }),
    [demoMode, providerId, apiKey],
  );

  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}
