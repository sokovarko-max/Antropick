import { describe, expect, it } from "vitest";
import { CostMonitor, estimateCostUsd } from "@/services/session/CostMonitor";

describe("estimateCostUsd", () => {
  it("computes cost from known per-model pricing", () => {
    const cost = estimateCostUsd("claude-sonnet-4-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(3 + 15, 5);
  });

  it("falls back to default pricing for an unknown model id", () => {
    const cost = estimateCostUsd("some-future-model", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(cost).toBeCloseTo(3, 5);
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
