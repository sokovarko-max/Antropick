import { describe, expect, it } from "vitest";
import { buildAppServices } from "@/services/runtime/AppServices";
import { MockAIProvider, MOCK_MODEL_ID } from "@/services/ai/MockAIProvider";
import type { AIStreamChunk } from "@/services/ai/types";
import { estimateCostUsd } from "@/services/session/CostMonitor";

describe("buildAppServices demo-mode decision", () => {
  it("uses the real provider once demo mode is off and a key is present", () => {
    const services = buildAppServices({ demoMode: false, providerId: "groq", apiKey: "gsk_test" });
    expect(services.isDemoMode).toBe(false);
    expect(services.demoModeReason).toBeNull();
    expect(services.aiProvider.id).toBe("groq");
  });

  it("stays in demo mode when the setting is on even with a valid key", () => {
    // This is the reported bug: a user adds a working key, the connection test
    // passes, and answers are still canned because the persisted demoMode flag
    // (which defaults to true) is never cleared. The behaviour is intentional;
    // what was missing was any way for the user to see why.
    const services = buildAppServices({ demoMode: true, providerId: "groq", apiKey: "gsk_test" });
    expect(services.isDemoMode).toBe(true);
    expect(services.demoModeReason).toBe("EXPLICIT_SETTING");
  });

  it("reports the missing key as the reason when that is what is missing", () => {
    const services = buildAppServices({ demoMode: false, providerId: "groq", apiKey: null });
    expect(services.isDemoMode).toBe(true);
    expect(services.demoModeReason).toBe("NO_API_KEY");
  });

  it("blames the setting, not the key, when both would trigger demo mode", () => {
    const services = buildAppServices({ demoMode: true, providerId: "groq", apiKey: null });
    expect(services.demoModeReason).toBe("EXPLICIT_SETTING");
  });
});

describe("MockAIProvider cost reporting", () => {
  it("tags its streamed answer with the mock model id", async () => {
    const chunks: AIStreamChunk[] = [];
    for await (const chunk of new MockAIProvider().stream({
      taskType: "REALTIME",
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    const final = chunks.at(-1);
    expect(final?.done).toBe(true);
    expect(final?.modelId).toBe(MOCK_MODEL_ID);
  });

  it("produces an answer that cannot be priced", async () => {
    // End to end for the displayed-cost bug: mock tokens × a real model's rate
    // is what put "$0.0019" under a demo answer.
    const response = await new MockAIProvider().generate({
      taskType: "REALTIME",
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(estimateCostUsd(response.modelId, response.usage)).toBeNull();
  });
});
