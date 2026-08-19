# CLAUDE.md — Interview Copilot

This file guides Claude Code (or any contributor) working inside `interview-copilot/`. It is scoped to this subproject; it does not apply to the unrelated gym-tracker app at the repo root.

## What this is
A Windows 11 desktop AI interview assistant (Tauri 2 + React/TS frontend, Rust backend). See `docs/architecture.md`, `docs/requirements.md`, `docs/data-flow.md`, `docs/security.md` for the full design and explicit scope boundaries — read those before making architectural changes.

## Commands
Run all commands from `interview-copilot/`.

```bash
pnpm install          # install deps
pnpm dev              # Vite dev server for the React app (browser-only; no Tauri APIs, no overlay/hotkeys/audio)
pnpm build             # typecheck + build the frontend bundle
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest unit tests
pnpm test:watch         # vitest watch mode
pnpm lint                # eslint
pnpm format               # prettier --write

# Rust — these DO run on Linux once the system libraries below are present:
cd src-tauri && cargo check
cd src-tauri && cargo clippy --all-targets
cd src-tauri && cargo test          # DSP unit tests in src/audio/vad.rs

pnpm tauri dev              # full desktop app (needs a display; not usable headless)
pnpm tauri build             # production Windows build/installer — Windows or windows-latest CI only
```

### System libraries needed to compile `src-tauri` on Linux
```bash
apt-get install -y libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev \
                   libwayland-dev libxcb1-dev libxrandr-dev libdbus-1-dev \
                   libpipewire-0.3-dev libasound2-dev libgbm-dev libclang-dev
```
webkit2gtk/soup are Tauri's; pipewire/gbm/wayland/xcb are `xcap`'s (screen capture); alsa is `cpal`'s (audio). All are Linux-only — none apply to the Windows build.

## Coding rules
- Strict TypeScript everywhere in `src/`; no `any` in `src/services/**` — use `unknown` + narrowing or a Zod schema.
- Every Tauri `invoke()` call site validates its response with Zod before trusting the shape.
- Business logic (context assembly, scoring, question detection parsing, memory rollup) lives in `src/services/**` as plain TS with no Tauri/React import, so it stays unit-testable without a native build. UI components call services; services never import React.
- AI/vendor code must go through `AIProvider` (`src/services/ai/types.ts`). Never call `fetch` to `api.anthropic.com` outside `AnthropicProvider`.
- Model IDs are never hardcoded at call sites — read them from `ModelRouter`/`src/config/models.ts`.
- Prompts live as `.md` files under `prompts/`, loaded via `PromptLoader` (`src/services/prompts/PromptLoader.ts`). Do not inline large prompt strings in components or services.
- No secrets in code, logs, DB, or JSON settings — see `docs/security.md`. The only allowed place for the API key is OS secure storage via the two `secure_store_*` Tauri commands.
- Keep components small; a page component orchestrates, it does not itself contain business logic — that belongs in a service/store.
- i18n: no hardcoded UI copy strings in components — add keys to `src/i18n/en.json` and `src/i18n/ru.json`.

## Testing rules
- New service logic (`src/services/**`) needs a Vitest unit test in `tests/unit/`.
- Network calls in tests are mocked — never hit the real Anthropic API from unit tests.
- Run `pnpm typecheck && pnpm lint && pnpm test` before considering a change done; run `pnpm build` before considering a milestone/phase done.
- Do not attempt to run `pnpm tauri dev`/`build` or `cargo` commands in this container — there is no `webkit2gtk` here and it will fail to compile. Those are validated on a real Windows machine or `windows-latest` CI.

## Project conventions
- Directory layout matches `docs/architecture.md` §2 and the master spec's structure (`src/{components,pages,features,services,stores,types,utils}`, `src-tauri/src/{audio,capture,database,hotkeys,security,window,commands}`, `prompts/`).
- Commit style: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`, small and scoped to one phase/step at a time (see `docs/requirements.md` for phase boundaries).
- `DEMO_MODE=true` must keep the entire UI usable with mock AI/STT and no API key — do not let a feature hard-depend on a live key without a demo-mode fallback.

## Verification status — what is actually proven vs. still assumed

**Verified in CI-like conditions (Linux container, no Windows, no hardware, no API key):**
- Frontend: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` all clean.
- Rust: `cargo check`, `cargo clippy --all-targets`, and `cargo test` all clean — the crate compiles and its DSP tests pass. `cargo check --target x86_64-pc-windows-msvc` also type-checks the screen-capture path against the real Windows target (the full Windows check needs an MSVC toolchain for bundled SQLite's C code, which this container lacks).
- Demo mode drives the whole UI end to end in a headless browser, including session history surviving a reload.

**Still unproven — needs a real Windows machine:**
- Microphone / system-audio (WASAPI loopback) capture against real devices.
- Global hotkeys actually firing system-wide.
- Windows Credential Manager round-trip for the API key.
- `pnpm tauri build` producing and running a signed installer.
- Any call against the real Anthropic API (no key here), so latency targets in `docs/requirements.md` are still design targets, not measurements.

Keep this section honest: if you verify one of these, move it up; if you add something unverifiable here, add it below.
