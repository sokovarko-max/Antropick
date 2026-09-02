import type { AIUsage } from "@/services/ai/types";
import { MODEL_PRICING } from "@/config/models";

/**
 * Returns null when the model has no price on file — the caller must then
 * decline to show a figure. Guessing here is what let demo mode display
 * money that was never spent: fabricated token counts were multiplied by a
 * real model's rate because the fallback pretended to know the price.
 */
export function estimateCostUsd(modelId: string, usage: AIUsage): number | null {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return null;
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMillionUsd
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

  /**
   * A null cost means "unknown", not "free", so it is not folded into the
   * running total — adding it as zero would quietly under-report spend.
   */
  record(costUsd: number | null): void {
    if (costUsd === null) return;
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
