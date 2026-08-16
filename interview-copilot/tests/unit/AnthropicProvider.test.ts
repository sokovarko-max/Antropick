import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "@/services/ai/AnthropicProvider";
import { AIProviderError } from "@/services/ai/types";
import Anthropic from "@anthropic-ai/sdk";

function fakeClient(overrides: Partial<Anthropic["messages"]> = {}): Anthropic {
  return {
    messages: {
      create: vi.fn(),
      stream: vi.fn(),
      ...overrides,
    },
  } as unknown as Anthropic;
}

describe("AnthropicProvider", () => {
  it("generate() maps a text response and usage", async () => {
    const client = fakeClient({
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "hello" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "claude-sonnet-4-5",
        stop_reason: "end_turn",
      }),
    } as never);

    const provider = new AnthropicProvider({ apiKey: "test", client });
    const result = await provider.generate({
      taskType: "CHAT",
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("hello");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.modelId).toBe("claude-sonnet-4-5");
  });

  it("generate() wraps SDK errors in AIProviderError", async () => {
    const client = fakeClient({
      create: vi.fn().mockRejectedValue(new Error("network down")),
    } as never);

    const provider = new AnthropicProvider({ apiKey: "test", client });
    await expect(
      provider.generate({ taskType: "CHAT", systemPrompt: "sys", messages: [] }),
    ).rejects.toBeInstanceOf(AIProviderError);
  });

  it("analyzeImage() sends an image content block alongside prior messages", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "described" }],
      usage: { input_tokens: 1, output_tokens: 1 },
      model: "claude-sonnet-4-5",
      stop_reason: "end_turn",
    });
    const client = fakeClient({ create } as never);
    const provider = new AnthropicProvider({ apiKey: "test", client });

    await provider.analyzeImage({
      taskType: "VISION",
      systemPrompt: "sys",
      messages: [{ role: "user", content: "context" }],
      image: { base64: "abc123", mediaType: "image/png" },
    });

    const call = create.mock.calls[0]![0];
    expect(call.messages).toHaveLength(2);
    expect(call.messages[1].content[0].type).toBe("image");
    expect(call.messages[1].content[0].source.data).toBe("abc123");
  });
});
