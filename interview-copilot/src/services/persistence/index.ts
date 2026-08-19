import { LocalStoragePersistenceAdapter } from "./LocalStoragePersistenceAdapter";
import { SqlitePersistenceAdapter } from "./SqlitePersistenceAdapter";
import type { PersistenceAdapter } from "./types";

export * from "./types";
export * from "./rowMappers";
export { SqlitePersistenceAdapter } from "./SqlitePersistenceAdapter";
export { LocalStoragePersistenceAdapter } from "./LocalStoragePersistenceAdapter";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let adapter: PersistenceAdapter | null = null;

/** Real SQLite in the desktop build, localStorage in the browser dev server. */
export function getPersistenceAdapter(): PersistenceAdapter {
  adapter ??= isTauriRuntime()
    ? new SqlitePersistenceAdapter()
    : new LocalStoragePersistenceAdapter();
  return adapter;
}

/** Test seam — lets unit tests inject a fake adapter. */
export function setPersistenceAdapter(next: PersistenceAdapter | null): void {
  adapter = next;
}
