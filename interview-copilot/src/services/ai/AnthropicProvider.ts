import Anthropic from "@anthropic-ai/sdk";
import type {
  AIGenerateRequest,
  AIProvider,
  AIResponse,
  AIStreamChunk,
  AIVisionRequest,
} from "./types";
import { AIProviderError, type AIErrorCode } from "./types";
import { DEFAULT_MODEL_PROFILES } from "@/config/models";

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Injectable for tests; defaults to the real Anthropic SDK client. */
  client?: Anthropic;
}

/**
 * The only place in the codebase allowed to call the Anthropic SDK directly.
 * Every other service goes through the AIProvider interface / ModelRouter.
 */
export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  private readonly client: Anthropic;

  constructor(options: AnthropicProviderOptions) {
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        // The SDK refuses to run wherever `window`/`document` exist, since on
        // a public web page that would expose the key to anyone inspecting
        // network traffic. Tauri's renderer has those globals (it's a
        // WebView) but is not a public page — it's the same trust boundary
        // as the rest of this single-user desktop app, and the key never
        // leaves this process except in the request to api.anthropic.com.
        // Without this flag the constructor throws immediately and every
        // call site (Settings > Test Connection, the realtime pipeline)
        // fails with no useful message.
        dangerouslyAllowBrowser: true,
      });
  }

  async generate(request: AIGenerateRequest): Promise<AIResponse> {
    const profile = DEFAULT_MODEL_PROFILES[request.taskType];
    try {
      const response = await this.client.messages.create({
        model: profile.modelId,
        max_tokens: request.maxTokens ?? profile.maxTokens,
        temperature: request.temperature ?? profile.temperature,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      return toAIResponse(response);
    } catch (error) {
      throw wrapError(error);
    }
  }

  async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamChunk> {
    const profile = DEFAULT_MODEL_PROFILES[request.taskType];
    let stream;
    try {
      stream = this.client.messages.stream({
        model: profile.modelId,
        max_tokens: request.maxTokens ?? profile.maxTokens,
        temperature: request.temperature ?? profile.temperature,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (error) {
      throw wrapError(error);
    }

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { delta: event.delta.text, done: false };
        }
      }
      const final = await stream.finalMessage();
      yield {
        delta: "",
        done: true,
        usage: {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        },
        // The resolved model, not `profile.modelId`: an alias like
        // "claude-sonnet-4-5" comes back as a dated snapshot.
        modelId: final.model,
      };
    } catch (error) {
      throw wrapError(error);
    }
  }

  async analyzeImage(request: AIVisionRequest): Promise<AIResponse> {
    const profile = DEFAULT_MODEL_PROFILES[request.taskType];
    try {
      const response = await this.client.messages.create({
        model: profile.modelId,
        max_tokens: request.maxTokens ?? profile.maxTokens,
        temperature: request.temperature ?? profile.temperature,
        system: request.systemPrompt,
        messages: [
          ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user" as const,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: request.image.mediaType,
                  data: request.image.base64,
                },
              },
            ],
          },
        ],
      });
      return toAIResponse(response);
    } catch (error) {
      throw wrapError(error);
    }
  }

  async analyzeConversation(request: AIGenerateRequest): Promise<AIResponse> {
    return this.generate(request);
  }
}

function toAIResponse(response: Anthropic.Message): AIResponse {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    modelId: response.model,
    stopReason: response.stop_reason,
  };
}

/**
 * Classifies a vendor failure into a stable code the UI can localize.
 *
 * A 400 whose body mentions the credit balance is the one case worth reading
 * the message for: the status alone is indistinguishable from a malformed
 * request, but the fix (top up the account) is completely different.
 */
export function classifyAnthropicError(status: number | undefined, rawMessage: string): AIErrorCode {
  const message = rawMessage.toLowerCase();
  if (message.includes("credit balance") || message.includes("billing")) {
    return "INSUFFICIENT_CREDITS";
  }
  if (status === 401) return "INVALID_API_KEY";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 429) return "RATE_LIMITED";
  if (status !== undefined && status >= 500) return "SERVER_ERROR";
  return "UNKNOWN";
}

function wrapError(error: unknown): AIProviderError {
  if (error instanceof Anthropic.APIError) {
    const retryable = error.status === 429 || (error.status !== undefined && error.status >= 500);
    const code = classifyAnthropicError(error.status, error.message);
    return new AIProviderError(`Anthropic API error: ${error.message}`, error, retryable, code);
  }
  // No HTTP status at all usually means the request never left the machine.
  if (error instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(error.message)) {
    return new AIProviderError(error.message, error, true, "NETWORK_ERROR");
  }
  return new AIProviderError("Anthropic provider failed", error, false, "UNKNOWN");
}
