import { MODEL_PROFILES, type ModelProfile, type ProviderId, type TaskType } from "@/config/models";
import type { AIProvider } from "./types";

export interface ModelRouterSettings {
  /** Which vendor's profile table to resolve against. */
  providerId?: ProviderId;
  /** Per-task overrides coming from Settings. */
  overrides?: Partial<Record<TaskType, Partial<ModelProfile>>>;
}

/**
 * Resolves a TaskType to a concrete model configuration. This is the single
 * indirection layer that lets Settings change "which model does X" — and now
 * "which vendor" — without any call site knowing a model ID.
 */
export class ModelRouter {
  private readonly providers: Map<string, AIProvider>;
  private readonly providerId: ProviderId;

  constructor(
    providers: AIProvider[],
    private readonly settings: ModelRouterSettings = {},
  ) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
    this.providerId = settings.providerId ?? "anthropic";
  }

  resolveProfile(taskType: TaskType): ModelProfile {
    const base = MODEL_PROFILES[this.providerId][taskType];
    const override = this.settings.overrides?.[taskType];
    return override ? { ...base, ...override } : base;
  }

  resolveProvider(taskType: TaskType): AIProvider {
    const provider = this.providers.get(this.providerId);
    if (!provider) {
      throw new Error(
        `ModelRouter: no AIProvider registered for "${this.providerId}" (task ${taskType})`,
      );
    }
    return provider;
  }
}
