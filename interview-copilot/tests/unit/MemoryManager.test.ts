import { describe, expect, it } from "vitest";
import { MemoryManager } from "@/services/memory/MemoryManager";
import { TranscriptEngine } from "@/services/session/TranscriptEngine";
import type { AIProvider, AIResponse } from "@/services/ai/types";

function providerReturning(text: string): AIProvider {
  const response: AIResponse = { text, usage: { inputTokens: 1, outputTokens: 1 }, modelId: "x", stopReason: "end_turn" };
  return {
    id: "test",
    generate: async () => response,
    stream: async function* () {},
    analyzeImage: async () => response,
    analyzeConversation: async () => response,
  };
}

function fillTranscript(transcript: TranscriptEngine, count: number): void {
  for (let i = 0; i < count; i += 1) {
    transcript.append({ speaker: "INTERVIEWER", text: `segment ${i}`, timestampMs: i, confidence: 1 });
  }
}

describe("MemoryManager", () => {
  it("does not need a rollup before the configured segment threshold", () => {
    const manager = new MemoryManager(providerReturning("summary"), { rollupEverySegments: 20 });
    const transcript = new TranscriptEngine("sess1");
    fillTranscript(transcript, 10);
    expect(manager.shouldRollup(transcript)).toBe(false);
  });

  it("needs a rollup once the segment threshold is reached", () => {
    const manager = new MemoryManager(providerReturning("summary"), { rollupEverySegments: 20 });
    const transcript = new TranscriptEngine("sess1");
    fillTranscript(transcript, 20);
    expect(manager.shouldRollup(transcript)).toBe(true);
  });

  it("stores the generated summary and resets the rollup counter", async () => {
    const manager = new MemoryManager(providerReturning("Candidate discussed distributed systems."), {
      rollupEverySegments: 5,
    });
    const transcript = new TranscriptEngine("sess1");
    fillTranscript(transcript, 5);

    expect(manager.getSummary()).toBeNull();
    const summary = await manager.rollup(transcript);
    expect(summary).toBe("Candidate discussed distributed systems.");
    expect(manager.getSummary()).toBe(summary);
    expect(manager.shouldRollup(transcript)).toBe(false);
  });

  it("resets summary and counter on reset()", async () => {
    const manager = new MemoryManager(providerReturning("summary"), { rollupEverySegments: 1 });
    const transcript = new TranscriptEngine("sess1");
    fillTranscript(transcript, 1);
    await manager.rollup(transcript);
    manager.reset();
    expect(manager.getSummary()).toBeNull();
  });
});
