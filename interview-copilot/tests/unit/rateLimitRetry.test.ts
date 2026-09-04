import { describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleProvider,
  retryAfterMs,
} from "@/services/ai/OpenAICompatibleProvider";
import { AIProviderError } from "@/services/ai/types";
import { MODEL_PROFILES } from "@/config/models";

// The body Groq actually returned, trimmed to what the parser reads.
const GROQ_429 = JSON.stringify({
  error: {
    message:
      "Rate limit reached for model `qwen/qwen3.6-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Used 485, Requested 800. Please try again in 17.099999999s.",
    type: "tokens",
    code: "rate_limit_exceeded",
  },
});

function okResponse() {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: "openai/gpt-oss-120b",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function provider(fetchImpl: typeof fetch, onRetry?: (n: unknown) => void) {
  return new OpenAICompatibleProvider({
    providerId: "groq",
    apiKey: "gsk_test",
    baseUrl: "https://api.groq.com/openai/v1",
    fetchImpl,
    onRetry: onRetry as never,
  });
}

const call = { taskType: "CHAT" as const, systemPrompt: "s", messages: [] };

describe("retryAfterMs", () => {
  it("reads the wait out of Groq's message body", () => {
    // Groq puts the precise figure only here, not in a Retry-After header.
    expect(retryAfterMs(null, GROQ_429)).toBeCloseTo(17099.999999, 3);
  });

  it("prefers the standard header when the vendor sends one", () => {
    expect(retryAfterMs("2", GROQ_429)).toBe(2000);
  });

  it("understands a millisecond figure", () => {
    expect(retryAfterMs(null, "Please try again in 750ms")).toBe(750);
  });

  it("returns nothing when neither source says", () => {
    expect(retryAfterMs(null, "slow down")).toBeUndefined();
    expect(retryAfterMs("not-a-number", "slow down")).toBeUndefined();
  });
});

describe("rate-limited requests", () => {
  it("waits the vendor's own figure and succeeds on the retry", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response(GROQ_429, { status: 429 }))
        .mockResolvedValueOnce(okResponse());

      const promise = provider(fetchImpl as unknown as typeof fetch).generate(call);
      await vi.advanceTimersByTimeAsync(17_100);
      const result = await promise;

      expect(result.text).toBe("hi");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells the UI it is retrying, so the pause is not mistaken for a hang", async () => {
    vi.useFakeTimers();
    try {
      const notices: Array<{ waitMs: number; code: string }> = [];
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response(GROQ_429, { status: 429 }))
        .mockResolvedValueOnce(okResponse());

      const promise = provider(fetchImpl as unknown as typeof fetch, (n) =>
        notices.push(n as { waitMs: number; code: string }),
      ).generate(call);
      await vi.advanceTimersByTimeAsync(17_100);
      await promise;

      expect(notices).toHaveLength(1);
      expect(notices[0]!.code).toBe("RATE_LIMITED");
      expect(notices[0]!.waitMs).toBeGreaterThan(17_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up rather than stalling an interview behind a long limit", async () => {
    // A wait longer than the cap is worse than the failure: the candidate
    // needs to know to carry on unaided.
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "try again in 300s" } }), { status: 429 }),
    );

    await expect(provider(fetchImpl as unknown as typeof fetch).generate(call)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failure retrying cannot fix", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad key", { status: 401 }));
    await expect(provider(fetchImpl as unknown as typeof fetch).generate(call)).rejects.toBeInstanceOf(
      AIProviderError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("carries the wait on the error when it finally gives up", async () => {
    vi.useFakeTimers();
    try {
      // A fresh Response per call: a body can only be read once, and reusing
      // one object would leave later attempts with an empty detail string.
      const fetchImpl = vi.fn(async () => new Response(GROQ_429, { status: 429 }));
      const promise = provider(fetchImpl as unknown as typeof fetch)
        .generate(call)
        .catch((e: AIProviderError) => e);
      await vi.advanceTimersByTimeAsync(60_000);
      const error = (await promise) as AIProviderError;

      expect(error.code).toBe("RATE_LIMITED");
      expect(error.retryAfterMs).toBeGreaterThan(17_000);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("free-tier token budget", () => {
  it("keeps the vision request inside Groq's output-tokens-per-minute cap", () => {
    // The cap is 1000 OTPM for this model and it counts what a request
    // *reserves*. At 800 one screenshot claimed most of the minute and the
    // next call was rejected outright — the reported failure.
    expect(MODEL_PROFILES.groq.VISION.maxTokens).toBeLessThanOrEqual(500);
  });
});
