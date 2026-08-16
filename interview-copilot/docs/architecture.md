# Architecture — Interview Copilot (Windows 11)

## 1. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Shell | Tauri 2 | Native Windows window, small binary, Rust backend for OS-level access (global hotkeys, audio capture, secure credential storage, screen capture), WebView2-based renderer. Lighter and more secure than Electron; first-class Windows support. |
| UI | React 18 + TypeScript (strict) | Team familiarity, huge ecosystem, good fit for a state-heavy realtime UI. |
| Styling | Tailwind CSS | Fast to build a consistent dark-first design system without a component library lock-in. |
| State | Zustand | Minimal boilerplate, works well with frequent realtime updates (transcript stream, overlay state) without the ceremony of Redux. |
| Local DB | SQLite (via `tauri-plugin-sql` / `rusqlite` on the Rust side) | Local-first, no server, matches privacy requirements. |
| ORM | Drizzle ORM (`drizzle-orm/sqlite-proxy` or `better-sqlite3` in a Node sidecar is avoided — see note) | Type-safe schema/migrations without a heavy runtime. |
| Backend logic | Rust (`src-tauri`) | Owns audio capture, global hotkeys, screenshot capture, secure credential storage (Windows Credential Manager), SQLite access. |
| AI | Anthropic API (`@anthropic-ai/sdk`) behind an `AIProvider` interface | Only implemented provider in the MVP; interface leaves room for OpenAI/Gemini later without touching call sites. |
| STT | Provider abstraction (`SpeechToTextProvider`); MVP ships a cloud STT provider + a `MockSTTProvider` for demo mode | Realtime transcription is provider-agnostic so the vendor can be swapped. |
| Package manager | pnpm | Fast, disk-efficient, workspace support. |
| Testing | Vitest (unit), Playwright (E2E, renderer only), `cargo test` (Rust) | |
| Lint/format | ESLint + Prettier (TS), `cargo clippy` + `rustfmt` (Rust) | |

> **Note on Drizzle + SQLite in Tauri:** Drizzle's Node SQLite drivers (`better-sqlite3`) do not run inside the Tauri-bundled WebView (no Node runtime in the frontend process). The database lives in the **Rust** process. The chosen approach: Drizzle is used only to author the SQL schema/migrations (`drizzle-kit`) as the single source of truth; the Rust backend (`rusqlite`) executes the generated SQL and exposes typed Tauri `commands` to the frontend. The frontend never opens the SQLite file directly. This keeps "one schema, two consumers" without pulling a Node runtime into the desktop process. This is documented as a deliberate deviation from a naive "Drizzle in the browser" setup, which is not technically possible in Tauri.

## 2. Process boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  Rust process (src-tauri)                                    │
│  - Window management, tray, global hotkeys                   │
│  - Audio capture (mic + system/loopback via WASAPI)           │
│  - Screenshot / active-window capture                         │
│  - SQLite (rusqlite) + migrations                              │
│  - Secure credential storage (Windows Credential Manager)      │
│  - Exposes `invoke()` commands + emits events to the frontend  │
└───────────────────────────▲────────────────────────────────┘
                             │ Tauri IPC (commands + events)
┌───────────────────────────┴────────────────────────────────┐
│  WebView process (React + TS)                                │
│  - UI (Dashboard, Sessions, Documents, Settings, Overlay)      │
│  - AIProvider / ModelRouter (calls Anthropic API directly       │
│    over HTTPS — no Rust proxy needed, key is fetched from      │
│    secure storage via a Tauri command just before use)         │
│  - ContextEngine, MemoryManager, QuestionDetector (pure TS,     │
│    unit-testable, no OS dependency)                             │
└─────────────────────────────────────────────────────────────┘
```

Rationale: everything that *must* touch the OS (audio devices, global hotkeys, filesystem, secure storage, screen capture) lives in Rust. Everything that is business logic (context assembly, prompt construction, scoring) lives in TypeScript so it is portable to a future macOS/Linux build and unit-testable without a native toolchain.

## 3. AI architecture

```
UI / pipeline code
        │
        ▼
   ModelRouter.resolve(taskType) → { provider, modelId, params }
        │
        ▼
   AIProvider (interface)
        │
        ▼
   AnthropicProvider (implements AIProvider)
        │
        ▼
   Anthropic Messages API (text + vision)
```

`AIProvider` interface (see `src/services/ai/types.ts`):
- `generate(request): Promise<AIResponse>`
- `stream(request): AsyncIterable<AIStreamChunk>`
- `analyzeImage(request): Promise<AIResponse>`
- `analyzeConversation(request): Promise<AIResponse>`

`ModelRouter` maps a `TaskType` (`REALTIME | QUESTION_DETECTION | VISION | SESSION_ANALYSIS | CHAT | SUMMARY`) to a `modelId` string read from `Settings`, never hardcoded. Defaults are stored as configuration (`src/config/models.ts`), not literals scattered through the code, so upgrading a model is a config change.

Only `AnthropicProvider` ships in the MVP. `OpenAIProvider` / `GeminiProvider` are explicitly out of scope but the interface is designed so adding one is a new file + a router entry, not a rewrite.

## 4. Audio pipeline

```
Microphone (WASAPI capture)  ─┐
System audio (WASAPI loopback)─┼─► AudioMixer (Rust) ─► VAD ─► Chunker ─► STT provider ─► TranscriptEngine (TS)
```

Audio never fully buffers in memory: capture emits fixed-size PCM chunks (Rust `cpal` stream callback) over a bounded channel; the mixer combines mic + loopback into two logical channels (kept separate, not downmixed) so `SpeakerIdentifier` can default to `mic → CANDIDATE`, `loopback → INTERVIEWER` without diarization. Voice Activity Detection (VAD) trims silence before chunks cross into JS, to reduce STT cost and false triggers.

## 5. Realtime decision pipeline

```
TranscriptEngine (new segment)
        │
        ▼
QuestionDetector — cheap/fast model, strict JSON output
   { isQuestion, questionType, urgency, relevance, requiresVision, requiresUserProfile }
        │  (relevance ≥ threshold AND isQuestion) → trigger
        ▼
ContextEngine.assemble(taskType, segment) — selects only the context that
matters (recent transcript window, session summary, relevant resume/JD
chunks, user instructions) instead of the full history
        │
        ▼
AIProvider.stream(REALTIME prompt + assembled context)
        │
        ▼
Overlay renders streaming ANSWER / KEY POINTS
```

The question detector is the gate that keeps 95% of chatter from ever reaching the expensive model — this is the single most important cost/latency control in the system.

## 6. Context & memory

Four memory tiers (`src/services/memory/MemoryManager.ts`):
1. **Current utterance** — the triggering segment.
2. **Recent conversation** — rolling window (last N seconds / M turns).
3. **Session summary** — periodically regenerated (every few minutes or every K turns) by summarizing older transcript into compact bullet facts, then discarding the raw text from the "hot" context.
4. **User documents** — resume / job description / notes, chunked and scored for relevance to the current question (simple keyword + recency scoring in the MVP; swappable for embeddings later — see §8).

`ContextEngine.assemble()` is the only place that decides what goes into a prompt; it is unit-tested in isolation from the network layer.

## 7. Overlay

A second Tauri window (`overlay`), frameless, transparent, always-on-top, click-through toggle, positioned independent of the main window. State machine: `IDLE → LISTENING → THINKING → ANSWERING → ERROR`, driven by events emitted from the realtime pipeline. Global hotkeys (Rust, `global-hotkey` crate) call Tauri commands that emit events the overlay listens to.

## 8. Document ingestion / retrieval (MVP scope)

PDF/DOCX/TXT/MD parsing happens in the frontend (`pdfjs-dist`, `mammoth`) since it's pure computation with no OS dependency, then chunks are stored via the Rust DB layer. Retrieval in the MVP is lexical (TF-IDF-style scoring over chunks), not vector embeddings — this is called out explicitly as a scoped-down implementation of the spec's "Embeddings / retrieval" step, with the store designed so a real embedding index can be swapped in behind the same `ContextStore.query()` call without touching callers.

## 9. Known environment constraints (this build environment)

This scaffold was produced in a Linux container with no Windows, no audio hardware, no `webkit2gtk` system libraries, and no Anthropic API key. Concretely:
- The Rust `src-tauri` crate cannot be compiled here (Tauri requires WebKitGTK dev headers on Linux to build at all, even for a Windows cross-target check). It is written to compile on a real Windows/Tauri dev machine but is **untested by this session**.
- Audio capture, global hotkeys, screenshot capture, and Windows Credential Manager storage are implemented as Rust modules with the correct crate choices and command surface, but cannot be exercised here.
- The TypeScript layer (AIProvider, ModelRouter, ContextEngine, MemoryManager, QuestionDetector, database schema, UI) is fully testable and buildable in this environment and is covered by `pnpm build` / `pnpm test` / `pnpm lint` run in this session.
- No Windows installer can be produced from this container; `pnpm tauri build` must be run on Windows (or CI with a `windows-latest` runner).
