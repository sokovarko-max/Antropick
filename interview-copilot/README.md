# Interview Copilot

A Windows 11 desktop AI assistant for live interviews and calls. It listens to both sides of the conversation, detects when a question is actually aimed at you, and shows a short, usable suggestion in a floating overlay — plus screenshot analysis for coding tasks and diagrams, and a scored review after the interview.

Built with Tauri 2 (Rust backend) + React/TypeScript. Windows first; the architecture keeps macOS/Linux open.

> **Status: working scaffold, not a shipping product.** Demo mode runs the whole UI end to end today. Audio capture, global hotkeys, and secure key storage compile and are wired, but have never been run against real Windows hardware — see [Verification status](#verification-status).

## Requirements

- **Node** 20+ and **pnpm** 9+
- **Rust** stable (only needed for the desktop build, not the browser dev server)
- **Windows 10 (64-bit, version 1809+) or Windows 11** for the real desktop app; Linux/macOS work for frontend development. Nothing in this codebase is actually Windows-11-only — see the note under Installing the result below for the one thing that differs on Windows 10 (WebView2).
- An **API key** for real AI responses — Groq has a free tier (no card); Anthropic is paid. Optional either way: demo mode needs none.

## Installation

```bash
pnpm install
cp .env.example .env      # optional; the API key itself is NOT stored here
```

API keys are never read from `.env` in a real build. They go into OS secure storage (Windows Credential Manager) via **Settings → AI → Test Connection**, one key per provider. See [docs/security.md](docs/security.md).

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

`ANTHROPIC_API_KEY` / `GROQ_API_KEY` exist in the example file for local experiments only — production reads keys from secure storage, never from env.

## Testing

```bash
pnpm test                    # Vitest — 107 unit tests over the service layer
pnpm typecheck               # tsc --noEmit, strict
pnpm lint                    # ESLint
cd src-tauri && cargo test   # Rust — 12 DSP tests (VAD + chunking)
cd src-tauri && cargo clippy --all-targets
```

Network calls are always mocked in unit tests; nothing hits a real vendor API.

## Building & packaging

There is no pre-built installer to download — the app has to be built once, and a Windows installer can only be produced on Windows.

### Option A — let GitHub build it (no local toolchain)

`.github/workflows/interview-copilot-windows.yml` builds on a `windows-latest` runner and publishes the installer as a workflow artifact:

1. GitHub → **Actions** → **Interview Copilot (Windows)** → **Run workflow**
2. Wait for the run (roughly 15–25 minutes the first time; the Rust cache makes later runs much faster)
3. Open the finished run → **Artifacts** → download **InterviewCopilot-Setup**
4. Unzip it and run the `.exe` inside

The workflow runs typecheck, lint, and both test suites before building, so a red run means something is actually broken rather than the artifact being missing.

### Option B — build locally on Windows

Needs [Node 20+](https://nodejs.org), [pnpm](https://pnpm.io/installation), [Rust](https://rustup.rs), and **Visual Studio Build Tools** with the "Desktop development with C++" workload (the MSVC linker is required — Rust cannot link a Windows binary without it). The *build* machine's OS doesn't matter for this — only the OS the installer will later run on (see WebView2 note below).

```bash
git clone https://github.com/sokovarko-max/Antropick.git
cd Antropick/interview-copilot
pnpm install
pnpm tauri build
```

The installer lands in `src-tauri/target/release/bundle/nsis/`.

### Installing the result

The installer is **unsigned**, so SmartScreen will warn on first run — "More info" → "Run anyway". It installs per-user (no admin prompt) and creates Start Menu and Desktop shortcuts. Uninstall through Settings → Apps as usual.

**Windows 10 note (WebView2):** the app's UI renders inside Microsoft's WebView2 runtime. Windows 11 has it preinstalled; most Windows 10 machines already have it too (it's been pushed via Windows Update since mid-2022), but if yours doesn't, the NSIS installer detects that automatically and downloads the small (~2 MB) WebView2 bootstrapper during setup — no separate action needed, just an internet connection at install time. If you want to confirm or install it yourself first, grab the "Evergreen Bootstrapper" from https://developer.microsoft.com/microsoft-edge/webview2/.

App icons are generated from `src-tauri/icons/app-icon.png` with `pnpm tauri icon <source>`.

### First run

The app opens in **demo mode** with mock AI responses, so it is usable immediately without a key. For real suggestions, pick a provider in **Settings → AI**, paste a key, press **Test Connection**, then turn demo mode off in **Settings → General**. Keys go into Windows Credential Manager, never into a file in the repo.

## Choosing a provider

| | [Groq](https://console.groq.com/keys) | [Anthropic](https://console.anthropic.com/settings/keys) |
|---|---|---|
| Cost | Free tier, no credit card | Paid per token (an hour-long interview is typically well under $1) |
| Limits | 30 requests/min | Billing balance |
| Speed | Fastest available — matters most for live suggestions | Fast enough |
| Answer quality | Good | Better |
| Screenshot analysis (Ctrl+B) | Works, but on a preview-tier model | Production-grade |

Groq is the default because live suggestions are latency-bound, and a free tier removes the biggest barrier to trying the app at all. Both providers are wired through the same `AIProvider` interface, so switching is a dropdown.

Anything speaking OpenAI's `/chat/completions` works through the same code path — OpenRouter, LM Studio, or a local Ollama only need a base URL added to `PROVIDERS` in `src/config/models.ts`.

**A note on local models:** running the model on your own machine is appealing but does not work for the *live* suggestions on typical laptop hardware. Without a discrete GPU a 7–8B model produces 4–8 tokens/sec, so a short answer takes 20–35 seconds — long past the moment it was needed. Local models are viable for the post-interview analysis, where waiting a minute is fine.

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

**Proven** (runs clean in a Linux container with no Windows, no hardware, no API key): the full TypeScript layer builds, lints, and passes 107 tests; the entire Rust crate passes `cargo check`, `clippy`, and 12 tests; the screen-capture path also type-checks against `x86_64-pc-windows-msvc`; and demo mode drives onboarding → session → transcript → history in a headless browser with session history surviving a reload.

**Unproven, needs real Windows**: device audio capture, system-wide hotkeys, Credential Manager round-trip, installer build, and any real call to a provider — so the sub-3s latency goal is a design target, not a measurement.

## Troubleshooting

**"Screen capture needs the desktop app"** — you're in `pnpm dev`. Screenshots require `pnpm tauri dev`.

**Hotkeys do nothing in the browser** — expected; they're registered by Rust. The overlay's on-screen buttons do the same things.

**`cargo check` fails on a missing system library** — install the Linux packages above; the error names the missing `.pc` file.

**Demo mode won't turn off** — the app falls back to demo whenever no API key is present. Add one in Settings → AI and confirm the status reads Connected.

**Sessions disappear** — in the browser they're in `localStorage`; clearing site data wipes them. The desktop build uses SQLite in the OS app-data directory.
