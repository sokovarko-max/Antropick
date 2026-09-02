import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildAppServices } from "./AppServices";
import { AppServicesContext } from "./useAppServices";
import { useSettingsStore } from "@/stores/settingsStore";
import { apiKeyStorageKey, secureStoreGet } from "@/services/security/secureStore";

export function AppServicesProvider({ children }: { children: ReactNode }) {
  const demoMode = useSettingsStore((s) => s.demoMode);
  const providerId = useSettingsStore((s) => s.aiProvider);
  const apiKeyPresent = useSettingsStore((s) => s.apiKeyPresent[s.aiProvider]);
  // The real key is fetched from OS secure storage just-in-time and held only
  // in this component's memory — never in Zustand persisted state,
  // localStorage, or logs (see docs/security.md).
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!apiKeyPresent) {
      setApiKey(null);
      return;
    }
    secureStoreGet(apiKeyStorageKey(providerId)).then((key) => {
      if (!cancelled) setApiKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [apiKeyPresent, providerId]);

  const services = useMemo(
    () => buildAppServices({ demoMode, providerId, apiKey }),
    [demoMode, providerId, apiKey],
  );

  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

