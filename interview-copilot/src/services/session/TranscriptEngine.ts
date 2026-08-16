import type { TranscriptSegment } from "@/types";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `seg_${Date.now()}_${counter}`;
}

/**
 * Append-only store for a session's transcript. Pure TS, no OS dependency —
 * unit-testable in isolation from STT/audio.
 */
export class TranscriptEngine {
  private segments: TranscriptSegment[] = [];

  constructor(private readonly sessionId: string) {}

  append(input: Omit<TranscriptSegment, "id" | "sessionId">): TranscriptSegment {
    const segment: TranscriptSegment = { ...input, id: nextId(), sessionId: this.sessionId };
    this.segments.push(segment);
    return segment;
  }

  all(): readonly TranscriptSegment[] {
    return this.segments;
  }

  /** Segments within the last `windowMs`, relative to the latest segment's timestamp. */
  recentWindow(windowMs: number): TranscriptSegment[] {
    if (this.segments.length === 0) return [];
    const latest = this.segments[this.segments.length - 1]!.timestampMs;
    return this.segments.filter((s) => latest - s.timestampMs <= windowMs);
  }

  since(timestampMs: number): TranscriptSegment[] {
    return this.segments.filter((s) => s.timestampMs > timestampMs);
  }

  clear(): void {
    this.segments = [];
  }
}
