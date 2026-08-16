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

export async function secureStoreDelete(key: string): Promise<void> {
  if (isTauri) {
    await tauriInvoke("secure_store_delete", { key });
    return;
  }
  devOnlyMemoryStore.delete(key);
}

export const ANTHROPIC_API_KEY_STORAGE_KEY = "anthropic_api_key";
