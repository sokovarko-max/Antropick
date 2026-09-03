# Security — Interview Copilot

## Secrets
- The Anthropic API key is **never** written to source, `.env` in production builds, SQLite, or a plain JSON settings file.
- Storage: Windows Credential Manager via Rust (`keyring` crate, which wraps the Windows Credential Manager API on Windows). Accessed only through two Tauri commands: `secure_store_set` / `secure_store_get`.
  - The `secure-store-native` Cargo feature (on by default) forwards keyring's platform-store features and **must stay enabled**. Without it keyring silently resolves to its in-memory `mock` store, where every `Entry::new` gets its own empty credential: writes appear to succeed, reads return nothing, and the API key is unusable. `src-tauri/src/security/mod.rs` fails the build on Windows if the feature is off, and `secure_store_is_persistent` lets the UI warn on platforms where no native store is linked in.
  - `secure_store_set` reads the value back before reporting success, so a store that accepts a write and loses it cannot leave the UI showing a saved key that does not exist. The frontend holds the key in memory only for the duration of an in-flight request; it is never put in Zustand persisted state, `localStorage`, or logs.
- `.env.example` documents variable names only, with empty values.

## Logging
- Structured logger (`src/utils/logger.ts` on the frontend, `tracing` in Rust) with a fixed redaction rule: fields named/matching `apiKey|api_key|authorization|token` are replaced with `[REDACTED]` before a log line is emitted.
- Transcript text, raw audio, and screenshot bytes are **not** logged, even at debug level, unless `DEV_MODE=true` **and** an explicit `DEBUG_LOG_CONTENT=true` flag is set — this is a deliberate two-flag gate so content logging can never be enabled by accident in a shipped build.

## Input handling / OWASP-relevant surfaces
- **File uploads (documents):** validated by extension + magic-byte sniffing before parsing (`src/services/documents/validateFile.ts`); size-capped; parsed in a sandboxed worker where the platform supports it (`pdfjs-dist`/`mammoth` run in-process here since there's no server boundary to exploit, but output is treated as untrusted text — never interpolated into HTML without escaping, never used to build file paths).
- **Path traversal:** any user-supplied filename is never used directly as a filesystem path component; the Rust backend generates storage filenames (UUID) and keeps a DB mapping to the original name for display only.
- **XSS:** all user/AI-generated text rendered through React (auto-escaped by default); nowhere in the app does the frontend use `dangerouslySetInnerHTML` on AI or document content. If Markdown rendering is added later, it must go through a sanitizing renderer.
- **SQL injection:** all Rust-side SQLite access uses `rusqlite` parameterized queries; the Drizzle-authored schema/migrations are the source of truth but no raw string concatenation builds queries from user input anywhere in the stack.
- **Screenshot/temp file leakage:** screenshots are analyzed in-memory and only persisted to disk/DB if the user's Privacy Setting "save screenshots" is explicitly ON (default OFF). Any temp file created during capture is deleted immediately after the vision call completes or fails.
- **IPC boundary validation:** every Tauri command's input is validated with Zod on the frontend before `invoke()` and mirrored with a Rust-side type check — the frontend is not trusted to have validated correctly, since a compromised renderer must not be able to smuggle malformed data into the Rust process.

## Privacy defaults
| Setting | Default |
|---|---|
| Save transcript | ON (needed for session history) |
| Save screenshots | OFF |
| Save audio | OFF |
| Cloud processing | ON (required for STT/AI — disabling it turns those features off, does not silently no-op) |

## Error handling posture
- No silent failures: STT unavailable, AI provider unavailable, and audio-capture-unavailable each have an explicit UI state (see `docs/requirements.md` — Overlay `ERROR` state, Settings connection status) rather than failing invisibly.

## Known gaps in this environment
This scaffold could not be validated against a real Windows Credential Manager, a real filesystem attack surface on Windows, or a real Anthropic API key in this session (Linux container, no Windows, no key). The code is written to the rules above; a security review with a live Windows build and a real API key is still required before shipping.
