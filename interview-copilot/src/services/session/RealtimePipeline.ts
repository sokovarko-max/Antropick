import type { AppServices } from "@/services/runtime/AppServices";
import { TranscriptEngine } from "./TranscriptEngine";
import { loadPrompt } from "@/services/prompts/PromptLoader";
import { parseAnswerFormat } from "@/utils/parseAnswerFormat";
import { estimateCostUsd } from "./CostMonitor";
import type {
  DocumentChunk,
  ResponseLanguage,
  InterviewFramework,
  ResponseMode,
  Session,
  TranscriptSegment,
} from "@/types";

export interface RealtimePipelineCallbacks {
  onSegment: (segment: TranscriptSegment) => void;
  onTriggerStart: (segment: TranscriptSegment) => void;
  onAnswerDelta: (delta: string) => void;
  onAnswerComplete: (params: {
    prompt: string;
    fullText: string;
    inputTokens: number;
    outputTokens: number;
    modelId: string;
  }) => void;
  onError: (message: string) => void;
}

/**
 * Wires TranscriptEngine → QuestionDetector → ContextEngine → AIProvider
 * together per docs/data-flow.md §1. UI code (the Interview feature page)
 * owns starting/stopping STT and forwards its transcript events here.
 */
export class RealtimePipeline {
  readonly transcript: TranscriptEngine;
  private resumeChunks: DocumentChunk[] = [];
  private jobDescriptionChunks: DocumentChunk[] = [];
  private relevanceThreshold = 0.6;
  /**
   * Held separately from `session` so it can change mid-interview. The
   * pipeline is deliberately not rebuilt when the session object changes —
   * that would throw away the transcript — so reading the language off the
   * constructor's snapshot would pin it to whatever it was at the start.
   */
  private responseLanguage: ResponseLanguage;

  constructor(
    private readonly session: Session,
    private readonly services: AppServices,
    private readonly callbacks: RealtimePipelineCallbacks,
  ) {
    this.transcript = new TranscriptEngine(session.id);
    this.responseLanguage = session.responseLanguage;
  }

  setResponseLanguage(language: ResponseLanguage): void {
    this.responseLanguage = language;
  }

  setDocumentChunks(resume: DocumentChunk[], jobDescription: DocumentChunk[]): void {
    this.resumeChunks = resume;
    this.jobDescriptionChunks = jobDescription;
  }

  async handleTranscriptSegment(
    input: Omit<TranscriptSegment, "id" | "sessionId">,
  ): Promise<void> {
    const segment = this.transcript.append(input);
    this.callbacks.onSegment(segment);

    if (this.services.memoryManager.shouldRollup(this.transcript)) {
      await this.services.memoryManager.rollup(this.transcript);
    }

    if (segment.speaker !== "INTERVIEWER") return; // auto mode only reacts to interviewer speech
    if (this.session.mode !== "AUTO") return;

    const recentWindow = this.transcript.recentWindow(60_000);
    const detection = await this.services.questionDetector.classify(segment, recentWindow);
    if (!this.services.questionDetector.shouldTrigger(detection, this.relevanceThreshold)) return;

    await this.respondTo(segment);
  }

  /** Manual mode entry point (Ctrl+Q). */
  async respondToLatest(): Promise<void> {
    const all = this.transcript.all();
    const latest = all[all.length - 1];
    if (!latest) return;
    await this.respondTo(latest);
  }

  private async respondTo(segment: TranscriptSegment): Promise<void> {
    this.callbacks.onTriggerStart(segment);

    const context = this.services.contextEngine.assemble({
      triggerSegment: segment,
      transcript: this.transcript,
      sessionSummary: this.services.memoryManager.getSummary(),
      resumeChunks: this.resumeChunks,
      jobDescriptionChunks: this.jobDescriptionChunks,
      userInstructions: this.session.userInstructions,
      responseMode: this.session.responseMode,
      framework: this.session.framework,
    });

    const systemPrompt = buildRealtimeSystemPrompt(
      this.session.responseMode,
      this.session.framework,
      this.responseLanguage,
    );
    const userPrompt = buildRealtimeUserPrompt(context);

    let fullText = "";
    let inputTokens = 0;
    let outputTokens = 0;
    // Starts as the model we asked for, and is replaced by whatever actually
    // answered once the final chunk reports it. Reporting the requested model
    // unconditionally is what made demo answers look like paid Sonnet calls.
    let modelId = this.services.modelRouter.resolveProfile("REALTIME").modelId;

    try {
      for await (const chunk of this.services.aiProvider.stream({
        taskType: "REALTIME",
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        responseLanguage: this.responseLanguage,
      })) {
        if (!chunk.done) {
          fullText += chunk.delta;
          this.callbacks.onAnswerDelta(chunk.delta);
          continue;
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.inputTokens;
          outputTokens = chunk.usage.outputTokens;
        }
        if (chunk.modelId) modelId = chunk.modelId;
      }
      this.callbacks.onAnswerComplete({ prompt: userPrompt, fullText, inputTokens, outputTokens, modelId });
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : "AI provider unavailable");
    }
  }
}

function buildRealtimeSystemPrompt(
  responseMode: ResponseMode,
  framework: InterviewFramework,
  responseLanguage: "en" | "ru",
): string {
  return loadPrompt("realtime", {
    responseMode,
    framework: framework === "NONE" ? "no specific framework" : framework,
    responseLanguage: responseLanguage === "ru" ? "Russian" : "English",
  });
}

function buildRealtimeUserPrompt(context: ReturnType<import("@/services/context/ContextEngine").ContextEngine["assemble"]>): string {
  const parts: string[] = [];
  if (context.sessionSummary) parts.push(`Session summary so far:\n${context.sessionSummary}`);
  if (context.recentTranscript.length > 0) {
    parts.push(
      `Recent transcript:\n${context.recentTranscript.map((s) => `${s.speaker}: ${s.text}`).join("\n")}`,
    );
  }
  if (context.resumeChunks.length > 0) {
    parts.push(`Relevant resume excerpts:\n${context.resumeChunks.map((c) => c.text).join("\n---\n")}`);
  }
  if (context.jobDescriptionChunks.length > 0) {
    parts.push(
      `Relevant job description excerpts:\n${context.jobDescriptionChunks.map((c) => c.text).join("\n---\n")}`,
    );
  }
  if (context.userInstructions) parts.push(`Candidate's instructions to the AI:\n${context.userInstructions}`);
  parts.push(`Current question to respond to:\n${context.currentUtterance}`);
  return parts.join("\n\n");
}

export { parseAnswerFormat, estimateCostUsd };
