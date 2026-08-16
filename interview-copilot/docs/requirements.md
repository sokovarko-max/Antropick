# Requirements — Interview Copilot

Condensed from the product spec into testable requirements. Each item is tagged `[MVP]` (built in this scaffold's target scope) or `[LATER]` (interface/placeholder only, deliberately not implemented yet).

## Functional

### Sessions
- [MVP] Create a session with role, company, job description, resume, additional documents, AI instructions, response language, AI model, mode (auto/manual).
- [MVP] Session lifecycle: start → running → stop → analyzed.
- [MVP] Session history list with score, duration, date, role, company.
- [MVP] Session detail tabs: Overview, Transcript, AI Answers, Screenshots, Analysis, Chat.

### Documents
- [MVP] Upload PDF/DOCX/TXT/MD.
- [MVP] Text extraction → chunking → lexical relevance scoring (see architecture.md §8 for the embeddings deferral).
- [LATER] Vector embeddings-based retrieval.

### Realtime assistance
- [MVP] Transcript engine with speaker/timestamp/confidence.
- [MVP] Speaker identification defaulting to mic=CANDIDATE / system audio=INTERVIEWER.
- [MVP] Question detector classifying isQuestion/type/urgency/relevance, gating AI calls.
- [MVP] Auto mode (trigger on high-relevance questions) and Manual mode (`Ctrl+Q`).
- [MVP] Response modes SHORT/NORMAL/DETAILED, default SHORT, formatted as ANSWER / KEY POINTS / OPTIONAL EXAMPLE.
- [MVP] Interview frameworks selectable (STAR, PREP, CAR, technical, system design, behavioral, sales, PM) and passed into the realtime prompt.
- [MVP] Never invent candidate experience — enforced at the prompt level (`prompts/realtime.md`) and by only injecting facts present in the user profile/resume.

### Vision
- [MVP] Screenshot capture on `Ctrl+B` → Anthropic vision → structured response (problem/approach/complexity/solution for code, explanation for diagrams/charts).

### Overlay
- [MVP] Floating, frameless, always-on-top, movable, resizable overlay with IDLE/LISTENING/THINKING/ANSWERING/ERROR states and Ask AI / Screenshot / Pause / Hide controls, configurable hotkeys.

### Analysis
- [MVP] Post-interview scoring (0-100) across Technical/Communication/Structure/Relevance/Confidence/Experience/Problem-solving, each with transcript evidence.
- [MVP] Strengths/weaknesses/missed opportunities/red flags/best & weakest answers/recommendations.
- [MVP] Post-interview chat scoped to session context.

### Settings & privacy
- [MVP] Settings sections: General, AI, Audio, Appearance, Hotkeys, Privacy, Storage, Advanced.
- [MVP] API key stored via OS secure storage only (never DB/JSON/source).
- [MVP] Privacy toggles: save transcript / save screenshots / save audio / cloud processing, audio & screenshots default OFF.
- [MVP] Cost monitor: per-session token/cost tracking, daily/session limits, warning threshold.
- [MVP] Demo mode (`DEMO_MODE=true`) runs the full UI with mock transcript + mock AI, no API key required.
- [LATER] Windows Credential Manager integration is implemented in Rust but untested in this environment (see architecture.md §9).

### i18n
- [MVP] English + Russian, no hardcoded UI strings — all copy goes through `src/i18n`.

## Non-functional
- [MVP] Strict TypeScript, Zod validation at IPC/API boundaries, no `any` in service layer.
- [MVP] Target realtime latency budget tracked (STT/question-detection/AI/total) and surfaced in a dev-only Debug Panel; **not achievable to verify empirically in this environment** (no live audio/API key), so the budget is a design target, not a measured SLA yet.
- [MVP] No secrets in logs; structured logger with a redaction allowlist.
- [LATER] Windows installer (`.exe` via NSIS/WiX through `tauri-bundler`) — requires a Windows or `windows-latest` CI build host.
- [LATER] Full offline mode UX (session history/settings usable, realtime AI disabled with explicit messaging).

## Explicitly out of scope for this pass
- OpenAI/Gemini providers (interface only).
- Real embeddings-based RAG.
- Actual Windows Credential Manager round-trip test (needs Windows).
- Actual microphone/system-audio capture test (needs Windows + hardware).
- Windows installer build/signing.
