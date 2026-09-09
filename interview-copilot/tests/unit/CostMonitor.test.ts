import { describe, expect, it } from "vitest";
import { CostMonitor, estimateCostUsd } from "@/services/session/CostMonitor";
import { MODEL_PRICING, MODEL_PROFILES } from "@/config/models";
import { MOCK_MODEL_ID } from "@/services/ai/MockAIProvider";

describe("estimateCostUsd", () => {
  it("computes cost from known per-model pricing", () => {
    const cost = estimateCostUsd("claude-sonnet-4-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(3 + 15, 5);
  });

  it("returns null rather than guessing for an unknown model id", () => {
    // Regression: this used to fall back to Sonnet's rate, so a demo-mode
    // answer with fabricated token counts was displayed as real money spent,
    // and a Groq answer was priced at Anthropic's rate.
    expect(estimateCostUsd("some-future-model", { inputTokens: 1_000_000, outputTokens: 0 })).toBeNull();
  });

  it("returns null for the demo-mode mock model", () => {
    expect(estimateCostUsd(MOCK_MODEL_ID, { inputTokens: 500, outputTokens: 500 })).toBeNull();
  });

  it("reports free-tier models as zero, not as unknown", () => {
    // Zero and null mean different things to the UI: "no charge (free tier)"
    // versus "we don't know what this cost".
    expect(estimateCostUsd("openai/gpt-oss-120b", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(0);
  });
});

describe("MODEL_PRICING coverage", () => {
  it("has an entry for every model any provider profile can select", () => {
    // Without this, adding a provider silently makes its answers unpriceable
    // (or, before the fix, priced at some other vendor's rate).
    const missing = Object.values(MODEL_PROFILES)
      .flatMap((profiles) => Object.values(profiles).map((p) => p.modelId))
      .filter((modelId) => !(modelId in MODEL_PRICING));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe("CostMonitor", () => {
  it("accumulates session and daily cost independently until reset", () => {
    const monitor = new CostMonitor({ sessionLimitUsd: 1, dailyLimitUsd: 5, warningThreshold: 0.8 });
    monitor.record(0.5);
    monitor.record(0.4);
    expect(monitor.getSessionCost()).toBeCloseTo(0.9, 5);
    expect(monitor.getDailyCost()).toBeCloseTo(0.9, 5);

    monitor.resetSession();
    expect(monitor.getSessionCost()).toBe(0);
    expect(monitor.getDailyCost()).toBeCloseTo(0.9, 5);
  });

  it("flags over-limit and near-limit thresholds correctly", () => {
    const monitor = new CostMonitor({ sessionLimitUsd: 1, dailyLimitUsd: 10, warningThreshold: 0.5 });
    monitor.record(0.4);
    expect(monitor.isNearAnyLimit()).toBe(false);
    monitor.record(0.2);
    expect(monitor.isNearAnyLimit()).toBe(true);
    expect(monitor.isOverSessionLimit()).toBe(false);
    monitor.record(0.5);
    expect(monitor.isOverSessionLimit()).toBe(true);
  });
});
