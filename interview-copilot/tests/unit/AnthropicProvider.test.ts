import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider, classifyAnthropicError } from "@/services/ai/AnthropicProvider";
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
  // Regression test for a bug that shipped: every other test here injects a
  // fake client, so the real SDK constructor was never exercised. The SDK
  // refuses to start where `window`/`document`/`navigator` exist — which is
  // true of both jsdom and Tauri's WebView — unless dangerouslyAllowBrowser
  // is set. Without it, Test Connection failed for every key.
  it("constructs a real SDK client in a browser-like environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof window.document).toBe("object");
    expect(() => new AnthropicProvider({ apiKey: "sk-ant-test" })).not.toThrow();
  });

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

describe("classifyAnthropicError", () => {
  it("recognises the real 'credit balance too low' body as a billing problem", () => {
    // Verbatim from a live 400 hit during Windows testing — the status alone
    // is indistinguishable from a malformed request, but the fix is different.
    const body =
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';
    expect(classifyAnthropicError(400, body)).toBe("INSUFFICIENT_CREDITS");
  });

  it("maps auth, permission, rate-limit and server statuses", () => {
    expect(classifyAnthropicError(401, "authentication_error")).toBe("INVALID_API_KEY");
    expect(classifyAnthropicError(403, "permission_error")).toBe("PERMISSION_DENIED");
    expect(classifyAnthropicError(429, "rate_limit_error")).toBe("RATE_LIMITED");
    expect(classifyAnthropicError(500, "internal error")).toBe("SERVER_ERROR");
    expect(classifyAnthropicError(529, "overloaded")).toBe("SERVER_ERROR");
  });

  it("prefers the billing diagnosis over the raw status", () => {
    // A billing failure can arrive on more than one status code.
    expect(classifyAnthropicError(403, "billing issue")).toBe("INSUFFICIENT_CREDITS");
  });

  it("falls back to UNKNOWN for an unrecognised 400", () => {
    expect(classifyAnthropicError(400, "max_tokens must be positive")).toBe("UNKNOWN");
  });
});
