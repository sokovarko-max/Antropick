import type { AIProvider } from "@/services/ai/types";
import { loadPrompt } from "@/services/prompts/PromptLoader";
import type { TranscriptEngine } from "@/services/session/TranscriptEngine";

export interface MemoryManagerOptions {
  /** Regenerate the summary after this many new segments since the last rollup. */
  rollupEverySegments: number;
}

const DEFAULT_OPTIONS: MemoryManagerOptions = { rollupEverySegments: 20 };

/**
 * Owns the four-tier memory model from docs/architecture.md §6: current
 * utterance and recent conversation are read directly from TranscriptEngine;
 * this class owns tier 3 (session summary), periodically compacting older
 * transcript into bullet facts so it can be dropped from the "hot" context.
 */
export class MemoryManager {
  private summary: string | null = null;
  private lastRollupAtSegmentCount = 0;

  constructor(
    private readonly provider: AIProvider,
    private readonly options: MemoryManagerOptions = DEFAULT_OPTIONS,
  ) {}

  getSummary(): string | null {
    return this.summary;
  }

  shouldRollup(transcript: TranscriptEngine): boolean {
    return transcript.all().length - this.lastRollupAtSegmentCount >= this.options.rollupEverySegments;
  }

  async rollup(transcript: TranscriptEngine): Promise<string> {
    const segments = transcript.all();
    const newSegments = segments.slice(this.lastRollupAtSegmentCount);
    const transcriptText = newSegments.map((s) => `${s.speaker}: ${s.text}`).join("\n");

    const response = await this.provider.generate({
      taskType: "SUMMARY",
      systemPrompt: loadPrompt("summary"),
      messages: [
        {
          role: "user",
          content: this.summary
            ? `Existing summary:\n${this.summary}\n\nNew transcript to fold in:\n${transcriptText}`
            : `Transcript:\n${transcriptText}`,
        },
      ],
    });

    this.summary = response.text.trim();
    this.lastRollupAtSegmentCount = segments.length;
    return this.summary;
  }

  reset(): void {
    this.summary = null;
    this.lastRollupAtSegmentCount = 0;
  }
}
