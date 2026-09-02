import type { TaskType } from "@/config/models";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIImageInput {
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
}

export interface AIGenerateRequest {
  taskType: TaskType;
  systemPrompt: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AIVisionRequest extends AIGenerateRequest {
  image: AIImageInput;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResponse {
  text: string;
  usage: AIUsage;
  modelId: string;
  stopReason: string | null;
}

export interface AIStreamChunk {
  delta: string;
  done: boolean;
  usage?: AIUsage;
  /**
   * The model that actually produced the text, reported on the final chunk.
   * Callers must prefer this over the model they asked for: the two differ in
   * demo mode (a mock answered) and whenever a vendor silently serves an
   * alias, and pricing the answer by the wrong one invents a cost.
   */
  modelId?: string;
}

/**
 * The only contract the rest of the app is allowed to depend on for talking
 * to an LLM vendor. See CLAUDE.md: no call site outside an AIProvider
 * implementation may call a vendor SDK/HTTP endpoint directly.
 */
export interface AIProvider {
  readonly id: string;
  generate(request: AIGenerateRequest): Promise<AIResponse>;
  stream(request: AIGenerateRequest): AsyncIterable<AIStreamChunk>;
  analyzeImage(request: AIVisionRequest): Promise<AIResponse>;
  analyzeConversation(request: AIGenerateRequest): Promise<AIResponse>;
}

/**
 * Stable, provider-agnostic reasons a call failed. The UI maps these to
 * localized copy — the service layer must not build user-facing sentences
 * itself, and a raw vendor JSON body is not something to show a user.
 */
export type AIErrorCode =
  | "INSUFFICIENT_CREDITS"
  | "INVALID_API_KEY"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = false,
    public readonly code: AIErrorCode = "UNKNOWN",
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
