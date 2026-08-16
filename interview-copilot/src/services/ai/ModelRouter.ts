import { DEFAULT_MODEL_PROFILES, type ModelProfile, type TaskType } from "@/config/models";
import type { AIProvider } from "./types";

export interface ModelRouterSettings {
  /** Per-task modelId overrides coming from Settings; falls back to DEFAULT_MODEL_PROFILES. */
  overrides?: Partial<Record<TaskType, Partial<ModelProfile>>>;
}

/**
 * Resolves a TaskType to a concrete provider + model configuration. This is
 * the single indirection layer that lets Settings change "which model does
 * X" without any call site knowing a model ID.
 */
export class ModelRouter {
  private readonly providers: Map<string, AIProvider>;

  constructor(
    providers: AIProvider[],
    private readonly settings: ModelRouterSettings = {},
  ) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
  }

  resolveProfile(taskType: TaskType): ModelProfile {
    const base = DEFAULT_MODEL_PROFILES[taskType];
    const override = this.settings.overrides?.[taskType];
    return override ? { ...base, ...override } : base;
  }

  resolveProvider(taskType: TaskType): AIProvider {
    const profile = this.resolveProfile(taskType);
    const provider = this.providers.get(profile.provider);
    if (!provider) {
      throw new Error(
        `ModelRouter: no AIProvider registered for "${profile.provider}" (task ${taskType})`,
      );
    }
    return provider;
  }
}
