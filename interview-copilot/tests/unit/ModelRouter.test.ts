import { describe, expect, it } from "vitest";
import { ModelRouter } from "@/services/ai/ModelRouter";
import type { AIProvider } from "@/services/ai/types";
import { DEFAULT_MODEL_PROFILES } from "@/config/models";

function fakeProvider(id: string): AIProvider {
  return {
    id,
    generate: async () => {
      throw new Error("not implemented");
    },
    stream: async function* () {},
    analyzeImage: async () => {
      throw new Error("not implemented");
    },
    analyzeConversation: async () => {
      throw new Error("not implemented");
    },
  };
}

describe("ModelRouter", () => {
  it("resolves the default profile for a task type", () => {
    const router = new ModelRouter([fakeProvider("anthropic")]);
    const profile = router.resolveProfile("REALTIME");
    expect(profile).toEqual(DEFAULT_MODEL_PROFILES.REALTIME);
  });

  it("applies per-task overrides from settings without mutating the default", () => {
    const router = new ModelRouter([fakeProvider("anthropic")], {
      overrides: { REALTIME: { modelId: "custom-model" } },
    });
    expect(router.resolveProfile("REALTIME").modelId).toBe("custom-model");
    expect(DEFAULT_MODEL_PROFILES.REALTIME.modelId).not.toBe("custom-model");
  });

  it("resolves the registered provider instance for a task's provider id", () => {
    const anthropic = fakeProvider("anthropic");
    const router = new ModelRouter([anthropic]);
    expect(router.resolveProvider("VISION")).toBe(anthropic);
  });

  it("throws when no provider is registered for the resolved provider id", () => {
    const router = new ModelRouter([]);
    expect(() => router.resolveProvider("REALTIME")).toThrow(/no AIProvider registered/);
  });
});
