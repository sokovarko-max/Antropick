import { describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleProvider,
  classifyHttpError,
} from "@/services/ai/OpenAICompatibleProvider";
import { AIProviderError } from "@/services/ai/types";

const BASE_URL = "https://api.groq.com/openai/v1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Builds an SSE body, optionally splitting it into awkward network chunks. */
function sseResponse(frames: string[], chunkSize?: number): Response {
  const text = frames.map((f) => `data: ${f}\n\n`).join("") + "data: [DONE]\n\n";
  const bytes = new TextEncoder().encode(text);
  const size = chunkSize ?? bytes.length;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) {
        controller.enqueue(bytes.slice(i, i + size));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function provider(fetchImpl: typeof fetch) {
  return new OpenAICompatibleProvider({
    providerId: "groq",
    apiKey: "gsk_test",
    baseUrl: BASE_URL,
    fetchImpl,
  });
}

const completionBody = {
  choices: [{ message: { content: "hello there" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 12, completion_tokens: 3 },
  model: "openai/gpt-oss-120b",
};

describe("OpenAICompatibleProvider.generate", () => {
  it("maps an OpenAI-shaped completion onto the AIResponse contract", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(completionBody));
    const result = await provider(fetchImpl as unknown as typeof fetch).generate({
      taskType: "CHAT",
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("hello there");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    expect(result.modelId).toBe("openai/gpt-oss-120b");
    expect(result.stopReason).toBe("stop");
  });

  it("sends the key as a bearer token and the system prompt as a system message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(completionBody));
    await provider(fetchImpl as unknown as typeof fetch).generate({
      taskType: "CHAT",
      systemPrompt: "you are helpful",
      messages: [{ role: "user", content: "hi" }],
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_test");

    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({ role: "system", content: "you are helpful" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.model).toBe("openai/gpt-oss-120b");
  });

  it("does not append a trailing slash twice when the base URL has one", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(completionBody));
    const p = new OpenAICompatibleProvider({
      providerId: "groq",
      apiKey: "k",
      baseUrl: `${BASE_URL}/`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await p.generate({ taskType: "CHAT", systemPrompt: "s", messages: [] });
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${BASE_URL}/chat/completions`);
  });

  it("throws a typed error when the response carries no completion", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [] }));
    await expect(
      provider(fetchImpl as unknown as typeof fetch).generate({
        taskType: "CHAT",
        systemPrompt: "s",
        messages: [],
      }),
    ).rejects.toBeInstanceOf(AIProviderError);
  });
});

describe("OpenAICompatibleProvider.stream", () => {
  const frames = [
    JSON.stringify({ choices: [{ delta: { content: "Focus " } }] }),
    JSON.stringify({ choices: [{ delta: { content: "on " } }] }),
    JSON.stringify({ choices: [{ delta: { content: "reliability." } }] }),
    JSON.stringify({
      model: "openai/gpt-oss-120b",
      choices: [],
      usage: { prompt_tokens: 40, completion_tokens: 6 },
    }),
  ];

  async function collect(response: Response) {
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const chunks: string[] = [];
    let final: { inputTokens: number; outputTokens: number } | undefined;
    let modelId: string | undefined;

    for await (const chunk of provider(fetchImpl as unknown as typeof fetch).stream({
      taskType: "REALTIME",
      systemPrompt: "s",
      messages: [{ role: "user", content: "q" }],
    })) {
      if (chunk.done) {
        final = chunk.usage;
        modelId = chunk.modelId;
      } else {
        chunks.push(chunk.delta);
      }
    }
    return { text: chunks.join(""), final, modelId };
  }

  it("assembles the streamed answer and the final usage frame", async () => {
    const { text, final } = await collect(sseResponse(frames));
    expect(text).toBe("Focus on reliability.");
    expect(final).toEqual({ inputTokens: 40, outputTokens: 6 });
  });

  it("reports the model the vendor actually served, for pricing", async () => {
    // The caller prices the answer by this id. Reporting the requested model
    // instead is how a demo answer ended up billed at a real model's rate.
    const { modelId } = await collect(sseResponse(frames));
    expect(modelId).toBe("openai/gpt-oss-120b");
  });

  it("falls back to the requested model when no frame names one", async () => {
    const anonymous = frames.map((f) => {
      const parsed = JSON.parse(f) as Record<string, unknown>;
      delete parsed.model;
      return JSON.stringify(parsed);
    });
    const { modelId } = await collect(sseResponse(anonymous));
    expect(modelId).toBe("openai/gpt-oss-120b");
  });

  it("survives frames split mid-JSON across network reads", async () => {
    // A 7-byte read size guarantees frames are torn apart; naive line parsing
    // would drop or corrupt tokens here.
    const { text, final } = await collect(sseResponse(frames, 7));
    expect(text).toBe("Focus on reliability.");
    expect(final).toEqual({ inputTokens: 40, outputTokens: 6 });
  });

  it("requests usage explicitly, otherwise cost tracking would record zeros", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse(frames));
    const iterator = provider(fetchImpl as unknown as typeof fetch).stream({
      taskType: "REALTIME",
      systemPrompt: "s",
      messages: [],
    });
    await iterator[Symbol.asyncIterator]().next();

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("reports zero usage rather than throwing when the vendor omits the usage frame", async () => {
    const { text, final } = await collect(sseResponse(frames.slice(0, 3)));
    expect(text).toBe("Focus on reliability.");
    expect(final).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe("OpenAICompatibleProvider.analyzeImage", () => {
  it("attaches the screenshot as an OpenAI data-URI image part", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(completionBody));
    await provider(fetchImpl as unknown as typeof fetch).analyzeImage({
      taskType: "VISION",
      systemPrompt: "look",
      messages: [{ role: "user", content: "context" }],
      image: { base64: "AAAA", mediaType: "image/png" },
    });

    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    const last = body.messages[body.messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content[0].type).toBe("image_url");
    expect(last.content[0].image_url.url).toBe("data:image/png;base64,AAAA");
    // Vision must not silently fall back to the text-only model.
    expect(body.model).toBe("qwen/qwen3.6-27b");
  });
});

describe("error handling", () => {
  it("classifies HTTP statuses into actionable codes", () => {
    expect(classifyHttpError(401, "invalid api key")).toBe("INVALID_API_KEY");
    expect(classifyHttpError(403, "forbidden")).toBe("PERMISSION_DENIED");
    expect(classifyHttpError(429, "rate limit reached")).toBe("RATE_LIMITED");
    expect(classifyHttpError(503, "service unavailable")).toBe("SERVER_ERROR");
    expect(classifyHttpError(400, "bad request")).toBe("UNKNOWN");
  });

  it("treats quota/billing wording as a credits problem whatever the status", () => {
    expect(classifyHttpError(429, "You exceeded your current quota")).toBe("INSUFFICIENT_CREDITS");
    expect(classifyHttpError(402, "billing required")).toBe("INSUFFICIENT_CREDITS");
  });

  it("surfaces an HTTP failure as a typed AIProviderError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no key", { status: 401 }));
    await expect(
      provider(fetchImpl as unknown as typeof fetch).generate({
        taskType: "CHAT",
        systemPrompt: "s",
        messages: [],
      }),
    ).rejects.toMatchObject({ name: "AIProviderError", code: "INVALID_API_KEY" });
  });

  it("marks a failed connection as a retryable network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      provider(fetchImpl as unknown as typeof fetch).generate({
        taskType: "CHAT",
        systemPrompt: "s",
        messages: [],
      }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", retryable: true });
  });
});
