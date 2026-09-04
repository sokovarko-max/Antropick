import type { SpeechToTextProvider, STTChunk, TranscriptListener } from "./types";
import type { Speaker } from "@/types";

export interface CloudSTTProviderOptions {
  apiKey: string;
  endpointUrl: string;
  /** Injectable for tests. Defaults to the browser/Tauri WebSocket global. */
  createSocket?: (url: string) => WebSocket;
}

/**
 * Streaming STT over a websocket. The exact wire protocol depends on the
 * chosen vendor; this class implements the SpeechToTextProvider contract
 * generically (send binary PCM frames, receive JSON transcript events) so
 * swapping vendors means changing `buildFrame`/`parseEvent`, not callers.
 *
 * NOTE: unverified against a live vendor in this environment (no network
 * access to a real STT endpoint, no hardware audio). See CLAUDE.md.
 */
export class CloudSTTProvider implements SpeechToTextProvider {
  readonly id = "cloud";
  private socket: WebSocket | null = null;
  private listeners = new Set<TranscriptListener>();

  constructor(private readonly options: CloudSTTProviderOptions) {}

  async start(): Promise<void> {
    const create = this.options.createSocket ?? ((url: string) => new WebSocket(url));
    this.socket = create(`${this.options.endpointUrl}?token=${encodeURIComponent(this.options.apiKey)}`);
    this.socket.binaryType = "arraybuffer";

    this.socket.onmessage = (event) => {
      const parsed = parseEvent(event.data);
      if (parsed) this.emit(parsed);
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.socket) return reject(new Error("socket not created"));
      this.socket.onopen = () => resolve();
      this.socket.onerror = (err) => reject(err);
    });
  }

  async stop(): Promise<void> {
    this.socket?.close();
    this.socket = null;
  }

  pushAudio(chunk: STTChunk): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(buildFrame(chunk));
  }

  onTranscript(listener: TranscriptListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: Parameters<TranscriptListener>[0]): void {
    for (const listener of this.listeners) listener(event);
  }
}

function buildFrame(chunk: STTChunk): ArrayBuffer {
  const header = new Uint8Array([chunk.channel === "microphone" ? 0 : 1]);
  const body = new Uint8Array(chunk.pcm16.buffer);
  const frame = new Uint8Array(header.length + body.length);
  frame.set(header, 0);
  frame.set(body, header.length);
  return frame.buffer;
}

interface RawSTTEvent {
  text: string;
  channel: "microphone" | "system";
  timestampMs: number;
  confidence: number;
  isFinal: boolean;
}

function parseEvent(data: unknown): Parameters<TranscriptListener>[0] | null {
  if (typeof data !== "string") return null;
  try {
    const raw = JSON.parse(data) as RawSTTEvent;
    const speaker: Speaker = raw.channel === "microphone" ? "CANDIDATE" : "INTERVIEWER";
    return {
      text: raw.text,
      speaker,
      timestampMs: raw.timestampMs,
      confidence: raw.confidence,
      isFinal: raw.isFinal,
    };
  } catch {
    return null;
  }
}
