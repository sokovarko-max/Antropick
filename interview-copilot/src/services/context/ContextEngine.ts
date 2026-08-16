import type { TranscriptEngine } from "@/services/session/TranscriptEngine";
import { topRelevantChunks } from "./relevance";
import type {
  AssembledContext,
  DocumentChunk,
  InterviewFramework,
  ResponseMode,
  TranscriptSegment,
} from "@/types";

export interface ContextEngineOptions {
  recentWindowMs: number;
  maxChunksPerDocType: number;
}

const DEFAULT_OPTIONS: ContextEngineOptions = {
  recentWindowMs: 60_000,
  maxChunksPerDocType: 3,
};

export interface AssembleInput {
  triggerSegment: TranscriptSegment;
  transcript: TranscriptEngine;
  sessionSummary: string | null;
  resumeChunks: DocumentChunk[];
  jobDescriptionChunks: DocumentChunk[];
  userInstructions: string;
  responseMode: ResponseMode;
  framework: InterviewFramework;
  screenshotBase64?: string;
}

/**
 * The single place that decides what goes into a realtime/vision prompt.
 * Deliberately does NOT send the full transcript/documents on every call —
 * see docs/architecture.md §6.
 */
export class ContextEngine {
  constructor(private readonly options: ContextEngineOptions = DEFAULT_OPTIONS) {}

  assemble(input: AssembleInput): AssembledContext {
    const query = input.triggerSegment.text;

    return {
      currentUtterance: input.triggerSegment.text,
      recentTranscript: input.transcript.recentWindow(this.options.recentWindowMs),
      sessionSummary: input.sessionSummary,
      resumeChunks: topRelevantChunks(query, input.resumeChunks, this.options.maxChunksPerDocType),
      jobDescriptionChunks: topRelevantChunks(
        query,
        input.jobDescriptionChunks,
        this.options.maxChunksPerDocType,
      ),
      userInstructions: input.userInstructions,
      responseMode: input.responseMode,
      framework: input.framework,
      screenshotBase64: input.screenshotBase64,
    };
  }
}
