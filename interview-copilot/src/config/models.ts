/**
 * Central place for model IDs. Nothing outside this file (and Settings, which
 * overrides it) should hardcode an Anthropic model string — see CLAUDE.md.
 */

export type TaskType =
  | "REALTIME"
  | "QUESTION_DETECTION"
  | "VISION"
  | "SESSION_ANALYSIS"
  | "CHAT"
  | "SUMMARY";

export interface ModelProfile {
  provider: "anthropic";
  modelId: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Defaults, overridable per-task from Settings (persisted in the `settings`
 * table / secure store). Question detection uses the cheapest/fastest model
 * available since it runs on nearly every transcript segment; session
 * analysis uses the strongest model since it runs once per session over a
 * large context.
 */
export const DEFAULT_MODEL_PROFILES: Record<TaskType, ModelProfile> = {
  REALTIME: { provider: "anthropic", modelId: "claude-sonnet-4-5", maxTokens: 400, temperature: 0.4 },
  QUESTION_DETECTION: {
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    maxTokens: 200,
    temperature: 0,
  },
  VISION: { provider: "anthropic", modelId: "claude-sonnet-4-5", maxTokens: 800, temperature: 0.3 },
  SESSION_ANALYSIS: {
    provider: "anthropic",
    modelId: "claude-opus-4-1",
    maxTokens: 4000,
    temperature: 0.2,
  },
  CHAT: { provider: "anthropic", modelId: "claude-sonnet-4-5", maxTokens: 800, temperature: 0.5 },
  SUMMARY: { provider: "anthropic", modelId: "claude-haiku-4-5", maxTokens: 500, temperature: 0.2 },
};
