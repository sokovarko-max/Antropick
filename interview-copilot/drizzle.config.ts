import type { Config } from "drizzle-kit";

// Generates migration SQL consumed by the Rust backend (rusqlite) — the
// frontend never opens the .db file directly. See docs/architecture.md §1.
export default {
  schema: "./src/db/schema.ts",
  out: "./src-tauri/migrations",
  dialect: "sqlite",
} satisfies Config;
