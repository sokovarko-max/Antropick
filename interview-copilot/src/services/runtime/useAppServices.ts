import { createContext, useContext } from "react";
import type { AppServices } from "./AppServices";

/**
 * Kept out of the provider's .tsx file so that module exports only a
 * component — otherwise React Fast Refresh cannot hot-reload it.
 */
export const AppServicesContext = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error("useAppServices must be used within AppServicesProvider");
  return services;
}
