# Data flow — Interview Copilot

## 1. Realtime audio → suggestion

```
Mic capture (Rust/cpal) ──┐
                          ├─► AudioMixer (Rust) ─► VAD ─► fixed PCM chunks
Loopback capture (Rust) ──┘         │
                                     ▼ Tauri event "audio-chunk" {channel, pcm, ts}
                          SpeechToTextProvider.pushAudio() (TS)
                                     │
                                     ▼ onTranscript({text, speaker, ts, confidence})
                          TranscriptEngine.append() (TS)
                                     │
                                     ▼ new segment
                          QuestionDetector.classify(segment, recentWindow) (TS, cheap model)
                                     │  {isQuestion, questionType, urgency, relevance, requiresVision, requiresUserProfile}
                                     ▼ if relevance ≥ threshold (auto mode) OR Ctrl+Q (manual)
                          ContextEngine.assemble(REALTIME, segment) (TS)
                                     │ {currentUtterance, recentTranscript, sessionSummary,
                                     │  resumeChunks, jdChunks, userInstructions, screenshot?}
                                     ▼
                          ModelRouter.resolve(REALTIME) → {provider, modelId}
                                     ▼
                          AnthropicProvider.stream(prompt) ── Anthropic Messages API
                                     ▼ streamed tokens
                          Overlay state THINKING → ANSWERING, renders ANSWER / KEY POINTS
                                     ▼ on completion
                          SessionStore.recordAIResponse() → DB (ai_responses table)
```

## 2. Screenshot → vision answer

```
Ctrl+B (global hotkey, Rust) ─► capture_screenshot command (Rust: active window bitmap)
        │ emits "screenshot-captured" {path, ts}
        ▼
VisionService.analyze(screenshot, recentTranscript) (TS)
        │ builds prompt from prompts/vision.md + transcript context
        ▼
ModelRouter.resolve(VISION) → AnthropicProvider.analyzeImage()
        ▼
Overlay renders structured answer (problem/approach/complexity/solution, or explanation)
        ▼
SessionStore.recordScreenshot() → DB (screenshots table), respecting
Privacy Settings ("save screenshots" — default OFF ⇒ analyzed in-memory, not persisted)
```

## 3. Document ingestion

```
User selects file (Documents screen)
        ▼
DocumentParser (TS: pdfjs-dist / mammoth / plain text)
        ▼ extracted text
Chunker (TS: fixed-size overlapping chunks)
        ▼
ContextStore.index(sessionId, docType, chunks) (TS) → DB (documents, document_chunks)
        ▼ used later by
ContextEngine.assemble() — lexical relevance scoring pulls top-K chunks per query
```

## 4. Session summary / memory rollup

```
Every N minutes or M new segments:
TranscriptEngine (all segments since last summary)
        ▼
MemoryManager.rollup() (TS) → AIProvider.generate(SUMMARY prompt)
        ▼
SessionSummary (compact bullet facts) replaces raw transcript in the "hot" context window
        ▼ persisted
DB (sessions.summary, updated in place)
```

## 5. Post-interview analysis

```
Stop session
        ▼
SessionAnalysisService.analyze(sessionId) (TS)
        │ pulls full transcript + all ai_responses + documents
        ▼
ModelRouter.resolve(SESSION_ANALYSIS) → AnthropicProvider.generate() (large-context model)
        ▼ strict JSON: scores per category + evidence quotes + strengths/weaknesses/recommendations
DB (session_analysis table)
        ▼
Post-interview Chat reuses the same session context for follow-up Q&A
```

## 6. API key lifecycle

```
Settings → "Test Connection"
        ▼
Frontend calls Tauri command `secure_store_set("anthropic_api_key", key)`
        ▼ (Rust) writes to Windows Credential Manager, never to SQLite/JSON/disk in plaintext
AnthropicProvider needs a key at call time
        ▼
Frontend calls Tauri command `secure_store_get("anthropic_api_key")`
        ▼ key held in memory only for the duration of the request, never logged
```
