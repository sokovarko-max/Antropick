import { PROVIDERS, type ProviderId } from "@/config/models";

/**
 * Frontend wrapper around the Rust secure_store_* Tauri commands (see
 * src-tauri/src/commands/mod.rs, src-tauri/src/security/mod.rs). The real
 * key only ever exists here in memory for the duration of a call — it is
 * never put in Zustand persisted state, localStorage, or logs (docs/security.md).
 *
 * Outside a Tauri window (plain `pnpm dev` in a browser) there is no OS
 * credential store to call into; this falls back to an in-memory Map so
 * Settings > Test Connection is still exercisable during frontend-only
 * development. That fallback is intentionally NOT persisted across reloads.
 */

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const devOnlyMemoryStore = new Map<string, string>();

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function secureStoreSet(key: string, value: string): Promise<void> {
  if (isTauri) {
    await tauriInvoke("secure_store_set", { key, value });
    return;
  }
  devOnlyMemoryStore.set(key, value);
}

export async function secureStoreGet(key: string): Promise<string | null> {
  if (isTauri) {
    return tauriInvoke<string | null>("secure_store_get", { key });
  }
  return devOnlyMemoryStore.get(key) ?? null;
}

/**
 * Whether a stored key survives a restart. False when the Rust side had to
 * fall back to an in-memory store, and outside Tauri (the dev-only Map above).
 * The UI warns instead of reporting a key as saved.
 */
export async function secureStoreIsPersistent(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    return await tauriInvoke<boolean>("secure_store_is_persistent");
  } catch {
    // An older build without the command: assume the worst and warn, rather
    // than claim durability that cannot be checked.
    return false;
  }
}

export async function secureStoreDelete(key: string): Promise<void> {
  if (isTauri) {
    await tauriInvoke("secure_store_delete", { key });
    return;
  }
  devOnlyMemoryStore.delete(key);
}

/** Each provider keeps its own key, so switching back does not require re-entry. */
export function apiKeyStorageKey(providerId: ProviderId): string {
  return PROVIDERS[providerId].secureStorageKey;
}

export const ANTHROPIC_API_KEY_STORAGE_KEY = PROVIDERS.anthropic.secureStorageKey;
