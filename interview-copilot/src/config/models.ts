/**
 * Central place for model IDs. Nothing outside this file (and Settings, which
 * overrides it) should hardcode a model string — see CLAUDE.md.
 */

export type TaskType =
  | "REALTIME"
  | "QUESTION_DETECTION"
  | "VISION"
  | "SESSION_ANALYSIS"
  | "CHAT"
  | "SUMMARY";

export type ProviderId = "anthropic" | "groq";

export interface ModelProfile {
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  /** OpenAI-compatible base URL; absent for vendors with their own SDK. */
  baseUrl?: string;
  /** Key name in OS secure storage. */
  secureStorageKey: string;
  /** Where the user gets a key. */
  consoleUrl: string;
  /** True when the provider can analyze screenshots at all. */
  supportsVision: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderDescriptor> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    secureStorageKey: "anthropic_api_key",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    supportsVision: true,
  },
  groq: {
    id: "groq",
    label: "Groq (free tier)",
    baseUrl: "https://api.groq.com/openai/v1",
    secureStorageKey: "groq_api_key",
    consoleUrl: "https://console.groq.com/keys",
    supportsVision: true,
  },
};

/**
 * Defaults per provider, overridable from Settings.
 *
 * Question detection deliberately gets the smallest model: it runs on nearly
 * every transcript segment, so it dominates request count. Session analysis
 * gets the largest: it runs once and quality matters most there.
 */
export const MODEL_PROFILES: Record<ProviderId, Record<TaskType, ModelProfile>> = {
  anthropic: {
    REALTIME: { modelId: "claude-sonnet-4-5", maxTokens: 400, temperature: 0.4 },
    QUESTION_DETECTION: { modelId: "claude-haiku-4-5", maxTokens: 200, temperature: 0 },
    VISION: { modelId: "claude-sonnet-4-5", maxTokens: 800, temperature: 0.3 },
    SESSION_ANALYSIS: { modelId: "claude-opus-4-1", maxTokens: 4000, temperature: 0.2 },
    CHAT: { modelId: "claude-sonnet-4-5", maxTokens: 800, temperature: 0.5 },
    SUMMARY: { modelId: "claude-haiku-4-5", maxTokens: 500, temperature: 0.2 },
  },
  groq: {
    // Groq retired llama-3.3-70b-versatile and llama-3.1-8b-instant in
    // June 2026; these are the successors it names.
    REALTIME: { modelId: "openai/gpt-oss-120b", maxTokens: 400, temperature: 0.4 },
    QUESTION_DETECTION: { modelId: "openai/gpt-oss-20b", maxTokens: 200, temperature: 0 },
    // gpt-oss has no vision, so screenshots need the multimodal Qwen. It is
    // Groq preview-tier rather than production — see the note in Settings.
    VISION: { modelId: "qwen/qwen3.6-27b", maxTokens: 800, temperature: 0.3 },
    SESSION_ANALYSIS: { modelId: "openai/gpt-oss-120b", maxTokens: 4000, temperature: 0.2 },
    CHAT: { modelId: "openai/gpt-oss-120b", maxTokens: 800, temperature: 0.5 },
    SUMMARY: { modelId: "openai/gpt-oss-20b", maxTokens: 500, temperature: 0.2 },
  },
};

/** Kept for call sites that predate multi-provider support. */
export const DEFAULT_MODEL_PROFILES = MODEL_PROFILES.anthropic;
