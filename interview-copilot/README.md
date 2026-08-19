# Interview Copilot

A Windows 11 desktop AI assistant for live interviews and calls. It listens to both sides of the conversation, detects when a question is actually aimed at you, and shows a short, usable suggestion in a floating overlay — plus screenshot analysis for coding tasks and diagrams, and a scored review after the interview.

Built with Tauri 2 (Rust backend) + React/TypeScript. Windows first; the architecture keeps macOS/Linux open.

> **Status: working scaffold, not a shipping product.** Demo mode runs the whole UI end to end today. Audio capture, global hotkeys, and secure key storage compile and are wired, but have never been run against real Windows hardware — see [Verification status](#verification-status).

## Requirements

- **Node** 20+ and **pnpm** 9+
- **Rust** stable (only needed for the desktop build, not the browser dev server)
- **Windows 11** for the real desktop app; Linux/macOS work for frontend development
- An **Anthropic API key** for real AI responses — optional, demo mode needs none

## Installation

```bash
pnpm install
cp .env.example .env      # optional; the API key itself is NOT stored here
```

The Anthropic key is never read from `.env` in a real build. It goes into OS secure storage (Windows Credential Manager) via **Settings → AI → Test Connection**. See [docs/security.md](docs/security.md).

## Development

```bash
pnpm dev          # Vite dev server — full UI in a browser, demo mode, no Tauri APIs
pnpm tauri dev    # the actual desktop app: overlay, hotkeys, audio, SQLite
```

`pnpm dev` is the fast loop for UI work. Anything touching audio, hotkeys, screen capture, or secure storage needs `pnpm tauri dev`, since those are Rust-side and no-op in a plain browser.

### Compiling the Rust backend on Linux

```bash
apt-get install -y libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev \
                   libwayland-dev libxcb1-dev libxrandr-dev libdbus-1-dev \
                   libpipewire-0.3-dev libasound2-dev libgbm-dev libclang-dev
cd src-tauri && cargo check
```

None of these apply to the Windows build — they're the Linux backends for WebKit, screen capture, and audio.

## Environment variables

`.env.example` documents the full set. Only these matter day to day:

| Variable | Purpose |
|---|---|
| `DEMO_MODE` | `true` runs the UI on mock AI + a scripted transcript, no API key needed |
| `DEV_MODE` | Enables the dev-only debug panel and verbose (still redacted) logging |
| `DEBUG_LOG_CONTENT` | Second flag required before transcript/prompt content is ever logged |
| `STT_API_KEY` | Speech-to-text vendor key |
| `DATABASE_PATH` | Override the SQLite location (defaults to the OS app-data dir) |

`ANTHROPIC_API_KEY` exists in the example file for local experiments only — production reads the key from secure storage, never from env.

## Testing

```bash
pnpm test                    # Vitest — 77 unit tests over the service layer
pnpm typecheck               # tsc --noEmit, strict
pnpm lint                    # ESLint
cd src-tauri && cargo test   # Rust — 12 DSP tests (VAD + chunking)
cd src-tauri && cargo clippy --all-targets
```

Network calls are always mocked in unit tests; nothing hits the real Anthropic API.

## Building & packaging

```bash
pnpm build         # frontend bundle
pnpm tauri build   # Windows installer (.exe via NSIS) — must run on Windows or windows-latest CI
```

App icons are generated from `src-tauri/icons/app-icon.png` with `pnpm tauri icon <source>`.

## Architecture

```
Mic + system audio → VAD/chunking (Rust) → STT → TranscriptEngine
                                                       ↓
                                            QuestionDetector (cheap model)
                                                       ↓ only if relevant
                                            ContextEngine → AIProvider → Overlay

Ctrl+B → screen capture (Rust) → VisionService → Overlay
```

Two ideas carry most of the design:

- **`QuestionDetector` is a cost and latency gate.** Nearly every transcript segment hits a small, cheap model that answers one question — is this worth reacting to? Only what passes reaches the expensive realtime model. Without it, an hour of conversation would be an hour of large-model calls.
- **`AIProvider` is the only vendor seam.** Nothing outside `src/services/ai/` may call a vendor SDK. Swapping or adding a provider is a new file plus a `ModelRouter` entry, not a refactor.

Full detail: [architecture](docs/architecture.md) · [data flow](docs/data-flow.md) · [requirements](docs/requirements.md) · [security](docs/security.md). Contributor rules live in [CLAUDE.md](CLAUDE.md).

## Verification status

**Proven** (runs clean in a Linux container with no Windows, no hardware, no API key): the full TypeScript layer builds, lints, and passes 77 tests; the entire Rust crate passes `cargo check`, `clippy`, and 12 tests; the screen-capture path also type-checks against `x86_64-pc-windows-msvc`; and demo mode drives onboarding → session → transcript → history in a headless browser with session history surviving a reload.

**Unproven, needs real Windows**: device audio capture, system-wide hotkeys, Credential Manager round-trip, installer build, and any real Anthropic call — so the sub-3s latency goal is a design target, not a measurement.

## Troubleshooting

**"Screen capture needs the desktop app"** — you're in `pnpm dev`. Screenshots require `pnpm tauri dev`.

**Hotkeys do nothing in the browser** — expected; they're registered by Rust. The overlay's on-screen buttons do the same things.

**`cargo check` fails on a missing system library** — install the Linux packages above; the error names the missing `.pc` file.

**Demo mode won't turn off** — the app falls back to demo whenever no API key is present. Add one in Settings → AI and confirm the status reads Connected.

**Sessions disappear** — in the browser they're in `localStorage`; clearing site data wipes them. The desktop build uses SQLite in the OS app-data directory.
