import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildAppServices, type AppServices } from "./AppServices";
import { useSettingsStore } from "@/stores/settingsStore";
import { ANTHROPIC_API_KEY_STORAGE_KEY, secureStoreGet } from "@/services/security/secureStore";

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({ children }: { children: ReactNode }) {
  const demoMode = useSettingsStore((s) => s.demoMode);
  const anthropicApiKeyPresent = useSettingsStore((s) => s.anthropicApiKeyPresent);
  // The real key is fetched from OS secure storage just-in-time and held only
  // in this component's memory — never in Zustand persisted state,
  // localStorage, or logs (see docs/security.md).
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!anthropicApiKeyPresent) {
      setApiKey(null);
      return;
    }
    secureStoreGet(ANTHROPIC_API_KEY_STORAGE_KEY).then((key) => {
      if (!cancelled) setApiKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [anthropicApiKeyPresent]);

  const services = useMemo(
    () => buildAppServices({ demoMode, anthropicApiKey: apiKey }),
    [demoMode, apiKey],
  );

  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error("useAppServices must be used within AppServicesProvider");
  return services;
}
