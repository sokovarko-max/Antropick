import type { Speaker } from "@/types";

export interface STTChunk {
  channel: "microphone" | "system";
  pcm16: Int16Array;
  sampleRate: number;
  timestampMs: number;
}

export interface STTTranscriptEvent {
  text: string;
  speaker: Speaker;
  timestampMs: number;
  confidence: number;
  isFinal: boolean;
}

export type TranscriptListener = (event: STTTranscriptEvent) => void;

/**
 * Vendor-agnostic speech-to-text contract. Real providers wrap a cloud STT
 * websocket/streaming API; MockSTTProvider powers DEMO_MODE and tests.
 */
export interface SpeechToTextProvider {
  readonly id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  pushAudio(chunk: STTChunk): void;
  onTranscript(listener: TranscriptListener): () => void;
}
