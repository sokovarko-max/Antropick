# Generated migrations

This directory is populated by `pnpm drizzle-kit generate` (config: `../../drizzle.config.ts`, schema: `../../src/db/schema.ts`). `0000_ambitious_jackpot.sql` is the initial schema, generated from `src/db/schema.ts` and already wired into the `MIGRATIONS` array in `../src/database/mod.rs` via `include_str!`.

When `src/db/schema.ts` changes, run `pnpm drizzle-kit generate` again from `interview-copilot/`, then add the new `.sql` file to the `MIGRATIONS` array (in order) the same way.
