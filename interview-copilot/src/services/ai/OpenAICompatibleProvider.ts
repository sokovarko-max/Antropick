import { MODEL_PROFILES, type ModelProfile, type ProviderId, type TaskType } from "@/config/models";
import type {
  AIGenerateRequest,
  AIProvider,
  AIResponse,
  AIStreamChunk,
  AIVisionRequest,
} from "./types";
import { AIProviderError, type AIErrorCode } from "./types";

export interface OpenAICompatibleOptions {
  providerId: ProviderId;
  apiKey: string;
  baseUrl: string;
  profiles?: Record<TaskType, ModelProfile>;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

/**
 * Talks to any service exposing OpenAI's /chat/completions — Groq today,
 * and unchanged it also covers OpenRouter, LM Studio and Ollama's compatible
 * endpoint. That is the reason this is one provider with a configurable base
 * URL rather than a class per vendor.
 *
 * Uses plain fetch rather than the `openai` SDK: the surface used here is
 * small, and the SDK carries the same browser-environment guard that already
 * cost us a shipped bug once.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id: ProviderId;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly profiles: Record<TaskType, ModelProfile>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleOptions) {
    this.id = options.providerId;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.profiles = options.profiles ?? MODEL_PROFILES[options.providerId];
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async generate(request: AIGenerateRequest): Promise<AIResponse> {
    const profile = this.profiles[request.taskType];
    const body = await this.post({
      model: profile.modelId,
      max_tokens: request.maxTokens ?? profile.maxTokens,
      temperature: request.temperature ?? profile.temperature,
      messages: this.toMessages(request),
    });
    return parseCompletion(body, profile.modelId);
  }

  async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamChunk> {
    const profile = this.profiles[request.taskType];
    const response = await this.request({
      model: profile.modelId,
      max_tokens: request.maxTokens ?? profile.maxTokens,
      temperature: request.temperature ?? profile.temperature,
      messages: this.toMessages(request),
      stream: true,
      // Without this the final usage frame is omitted, and the cost monitor
      // would record every streamed answer as zero tokens.
      stream_options: { include_usage: true },
    });

    if (!response.body) {
      throw new AIProviderError("Streaming response had no body", undefined, true, "NETWORK_ERROR");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    let servedModelId: string | undefined;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are newline-delimited, but a network read can split one
        // mid-frame, so only whole lines are consumed and the tail is kept.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;

          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(payload);
          } catch {
            continue; // keep-alive or partial frame
          }

          if (typeof frame.model === "string") servedModelId = frame.model;

          const delta = extractDelta(frame);
          if (delta) yield { delta, done: false };

          const frameUsage = extractUsage(frame);
          if (frameUsage) usage = frameUsage;
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      delta: "",
      done: true,
      usage: usage ?? { inputTokens: 0, outputTokens: 0 },
      modelId: servedModelId ?? profile.modelId,
    };
  }

  async analyzeImage(request: AIVisionRequest): Promise<AIResponse> {
    const profile = this.profiles[request.taskType];
    const messages = this.toMessages(request);
    // OpenAI's vision shape: the image rides along in the last user turn as a
    // data URI rather than a separate content block type.
    messages.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${request.image.mediaType};base64,${request.image.base64}` },
        },
      ],
    });

    const body = await this.post({
      model: profile.modelId,
      max_tokens: request.maxTokens ?? profile.maxTokens,
      temperature: request.temperature ?? profile.temperature,
      messages,
    });
    return parseCompletion(body, profile.modelId);
  }

  async analyzeConversation(request: AIGenerateRequest): Promise<AIResponse> {
    return this.generate(request);
  }

  private toMessages(request: AIGenerateRequest): ChatMessage[] {
    return [
      { role: "system", content: request.systemPrompt },
      ...request.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  private async post(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request(payload);
    return response.json();
  }

  private async request(payload: Record<string, unknown>): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // fetch only rejects when the request never completed at all.
      throw new AIProviderError(
        error instanceof Error ? error.message : "Network request failed",
        error,
        true,
        "NETWORK_ERROR",
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const code = classifyHttpError(response.status, detail);
      throw new AIProviderError(
        `${this.id} API error: ${response.status} ${detail}`.trim(),
        undefined,
        code === "RATE_LIMITED" || code === "SERVER_ERROR",
        code,
      );
    }
    return response;
  }
}

/** Shared by every OpenAI-compatible vendor — the status codes are the contract. */
export function classifyHttpError(status: number, detail: string): AIErrorCode {
  const text = detail.toLowerCase();
  if (text.includes("credit") || text.includes("billing") || text.includes("quota")) {
    return "INSUFFICIENT_CREDITS";
  }
  if (status === 401) return "INVALID_API_KEY";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN";
}

function parseCompletion(body: unknown, fallbackModelId: string): AIResponse {
  const data = body as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const choice = data.choices?.[0];
  if (!choice?.message) {
    throw new AIProviderError("Response contained no completion", body, false, "UNKNOWN");
  }
  return {
    text: choice.message.content ?? "",
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    modelId: data.model ?? fallbackModelId,
    stopReason: choice.finish_reason ?? null,
  };
}

function extractDelta(frame: Record<string, unknown>): string {
  const choices = frame.choices as Array<{ delta?: { content?: string } }> | undefined;
  return choices?.[0]?.delta?.content ?? "";
}

function extractUsage(
  frame: Record<string, unknown>,
): { inputTokens: number; outputTokens: number } | undefined {
  const usage = frame.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}
