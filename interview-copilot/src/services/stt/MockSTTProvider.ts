import type { SpeechToTextProvider, STTChunk, TranscriptListener } from "./types";

const DEMO_SCRIPT: Array<{ speaker: "INTERVIEWER" | "CANDIDATE"; text: string }> = [
  { speaker: "INTERVIEWER", text: "Tell me about a challenging project you worked on recently." },
  {
    speaker: "CANDIDATE",
    text: "Sure — I led the migration of our monolith to a service-oriented architecture.",
  },
  { speaker: "INTERVIEWER", text: "Why did you choose PostgreSQL over other databases?" },
];

/** Powers DEMO_MODE and unit tests — emits a scripted transcript, no audio hardware needed. */
export class MockSTTProvider implements SpeechToTextProvider {
  readonly id = "mock";
  private listeners = new Set<TranscriptListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;

  async start(): Promise<void> {
    this.index = 0;
    this.timer = setInterval(() => {
      const line = DEMO_SCRIPT[this.index % DEMO_SCRIPT.length]!;
      this.index += 1;
      this.emit({
        text: line.text,
        speaker: line.speaker,
        timestampMs: Date.now(),
        confidence: 0.95,
        isFinal: true,
      });
    }, 4000);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  pushAudio(_chunk: STTChunk): void {
    // No-op: demo mode doesn't consume real audio.
  }

  onTranscript(listener: TranscriptListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Parameters<TranscriptListener>[0]): void {
    for (const listener of this.listeners) listener(event);
  }
}
