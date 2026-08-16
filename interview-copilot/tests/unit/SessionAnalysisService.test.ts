import { describe, expect, it } from "vitest";
import { SessionAnalysisService } from "@/services/session/SessionAnalysisService";
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

const validAnalysisJson = JSON.stringify({
  overallScore: 82,
  categoryScores: [{ category: "TECHNICAL", score: 85, evidence: "Explained CAP theorem correctly." }],
  strengths: ["Clear communication"],
  weaknesses: ["Could go deeper on tradeoffs"],
  missedOpportunities: [],
  redFlags: [],
  bestAnswers: ["Answer about database choice"],
  weakestAnswers: [],
  recommendations: ["Practice system design whiteboarding"],
});

describe("SessionAnalysisService", () => {
  it("parses a valid analysis JSON response into a SessionAnalysis", async () => {
    const service = new SessionAnalysisService(providerReturning(validAnalysisJson));
    const result = await service.analyze("sess1", [], []);
    expect(result.sessionId).toBe("sess1");
    expect(result.overallScore).toBe(82);
    expect(result.categoryScores[0]?.category).toBe("TECHNICAL");
  });

  it("throws when the model returns malformed JSON", async () => {
    const service = new SessionAnalysisService(providerReturning("not json"));
    await expect(service.analyze("sess1", [], [])).rejects.toThrow();
  });

  it("throws when required fields fail schema validation", async () => {
    const service = new SessionAnalysisService(providerReturning(JSON.stringify({ overallScore: "high" })));
    await expect(service.analyze("sess1", [], [])).rejects.toThrow();
  });
});
