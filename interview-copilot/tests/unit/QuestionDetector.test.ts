import { describe, expect, it } from "vitest";
import { QuestionDetector } from "@/services/questionDetector/QuestionDetector";
import type { AIProvider, AIResponse } from "@/services/ai/types";
import type { TranscriptSegment } from "@/types";

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

const segment: TranscriptSegment = {
  id: "s1",
  sessionId: "sess1",
  speaker: "INTERVIEWER",
  text: "Why did you choose PostgreSQL?",
  timestampMs: 1000,
  confidence: 0.9,
};

describe("QuestionDetector", () => {
  it("parses a well-formed JSON classification", async () => {
    const detector = new QuestionDetector(
      providerReturning(
        JSON.stringify({
          isQuestion: true,
          questionType: "TECHNICAL_TASK",
          urgency: 0.8,
          relevance: 0.9,
          requiresVision: false,
          requiresUserProfile: true,
        }),
      ),
    );
    const result = await detector.classify(segment, []);
    expect(result.isQuestion).toBe(true);
    expect(result.relevance).toBe(0.9);
  });

  it("tolerates surrounding prose around the JSON object", async () => {
    const detector = new QuestionDetector(
      providerReturning(
        `Here is the classification:\n${JSON.stringify({
          isQuestion: true,
          questionType: "QUESTION",
          urgency: 0.5,
          relevance: 0.7,
          requiresVision: false,
          requiresUserProfile: false,
        })}\nEnd.`,
      ),
    );
    const result = await detector.classify(segment, []);
    expect(result.isQuestion).toBe(true);
  });

  it("falls back to a safe non-triggering result on malformed output", async () => {
    const detector = new QuestionDetector(providerReturning("not json at all"));
    const result = await detector.classify(segment, []);
    expect(result.isQuestion).toBe(false);
    expect(result.relevance).toBe(0);
  });

  it("falls back when the JSON fails schema validation", async () => {
    const detector = new QuestionDetector(providerReturning(JSON.stringify({ isQuestion: "yes" })));
    const result = await detector.classify(segment, []);
    expect(result.isQuestion).toBe(false);
  });

  describe("shouldTrigger", () => {
    it("triggers only when isQuestion and relevance meets the threshold", () => {
      const detector = new QuestionDetector(providerReturning("{}"));
      expect(
        detector.shouldTrigger(
          { isQuestion: true, questionType: "QUESTION", urgency: 0, relevance: 0.6, requiresVision: false, requiresUserProfile: false },
          0.6,
        ),
      ).toBe(true);
      expect(
        detector.shouldTrigger(
          { isQuestion: true, questionType: "QUESTION", urgency: 0, relevance: 0.4, requiresVision: false, requiresUserProfile: false },
          0.6,
        ),
      ).toBe(false);
      expect(
        detector.shouldTrigger(
          { isQuestion: false, questionType: "IRRELEVANT", urgency: 0, relevance: 0.9, requiresVision: false, requiresUserProfile: false },
          0.6,
        ),
      ).toBe(false);
    });
  });
});
