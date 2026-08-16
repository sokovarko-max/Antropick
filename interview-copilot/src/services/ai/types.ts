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

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
