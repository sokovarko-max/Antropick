import type { AIUsage } from "@/services/ai/types";

/**
 * Rough per-model USD pricing (per 1M tokens), used only for the in-app cost
 * estimate shown to the user — not billing-accurate. Kept as data, not
 * scattered literals, so it's one place to update.
 */
const PRICE_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

export function estimateCostUsd(modelId: string, usage: AIUsage): number {
  const pricing = PRICE_PER_MILLION_TOKENS_USD[modelId] ?? { input: 3, output: 15 };
  return (
    (usage.inputTokens / 1_000_000) * pricing.input + (usage.outputTokens / 1_000_000) * pricing.output
  );
}

export interface CostLimits {
  sessionLimitUsd: number;
  dailyLimitUsd: number;
  warningThreshold: number; // 0-1, fraction of limit
}

export class CostMonitor {
  private sessionCostUsd = 0;
  private dailyCostUsd = 0;

  constructor(private readonly limits: CostLimits) {}

  record(costUsd: number): void {
    this.sessionCostUsd += costUsd;
    this.dailyCostUsd += costUsd;
  }

  getSessionCost(): number {
    return this.sessionCostUsd;
  }

  getDailyCost(): number {
    return this.dailyCostUsd;
  }

  isOverSessionLimit(): boolean {
    return this.sessionCostUsd >= this.limits.sessionLimitUsd;
  }

  isOverDailyLimit(): boolean {
    return this.dailyCostUsd >= this.limits.dailyLimitUsd;
  }

  isNearAnyLimit(): boolean {
    return (
      this.sessionCostUsd >= this.limits.sessionLimitUsd * this.limits.warningThreshold ||
      this.dailyCostUsd >= this.limits.dailyLimitUsd * this.limits.warningThreshold
    );
  }

  resetSession(): void {
    this.sessionCostUsd = 0;
  }

  resetDaily(): void {
    this.dailyCostUsd = 0;
  }
}
