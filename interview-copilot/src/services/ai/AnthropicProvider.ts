import Anthropic from "@anthropic-ai/sdk";
import type {
  AIGenerateRequest,
  AIProvider,
  AIResponse,
  AIStreamChunk,
  AIVisionRequest,
} from "./types";
import { AIProviderError } from "./types";
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

function wrapError(error: unknown): AIProviderError {
  if (error instanceof Anthropic.APIError) {
    const retryable = error.status === 429 || (error.status !== undefined && error.status >= 500);
    return new AIProviderError(`Anthropic API error: ${error.message}`, error, retryable);
  }
  return new AIProviderError("Anthropic provider failed", error, false);
}
