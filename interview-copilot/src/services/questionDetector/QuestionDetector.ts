import { z } from "zod";
import type { AIProvider } from "@/services/ai/types";
import { loadPrompt } from "@/services/prompts/PromptLoader";
import { stripReasoning } from "@/utils/parseAnswerFormat";
import type { QuestionDetectionResult, TranscriptSegment } from "@/types";

const resultSchema = z.object({
  isQuestion: z.boolean(),
  questionType: z.enum([
    "QUESTION",
    "FOLLOW_UP",
    "TECHNICAL_TASK",
    "BEHAVIORAL_QUESTION",
    "SMALL_TALK",
    "IRRELEVANT",
  ]),
  urgency: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  requiresVision: z.boolean(),
  requiresUserProfile: z.boolean(),
});

const FALLBACK: QuestionDetectionResult = {
  isQuestion: false,
  questionType: "IRRELEVANT",
  urgency: 0,
  relevance: 0,
  requiresVision: false,
  requiresUserProfile: false,
};

/**
 * The gate that keeps most transcript chatter from reaching the expensive
 * realtime model. Runs on a cheap/fast model (see config/models.ts).
 */
export class QuestionDetector {
  constructor(private readonly provider: AIProvider) {}

  async classify(
    segment: TranscriptSegment,
    recentWindow: TranscriptSegment[],
  ): Promise<QuestionDetectionResult> {
    const system = loadPrompt("question-detector");
    const windowText = recentWindow.map((s) => `${s.speaker}: ${s.text}`).join("\n");

    const response = await this.provider.generate({
      taskType: "QUESTION_DETECTION",
      systemPrompt: system,
      messages: [
        {
          role: "user",
          content: `Recent transcript:\n${windowText}\n\nCurrent segment (${segment.speaker}):\n${segment.text}`,
        },
      ],
    });

    return parseResult(response.text);
  }

  shouldTrigger(result: QuestionDetectionResult, relevanceThreshold = 0.6): boolean {
    return result.isQuestion && result.relevance >= relevanceThreshold;
  }
}

function parseResult(rawWithReasoning: string): QuestionDetectionResult {
  try {
    // A reasoning model's scratchpad routinely contains braces, so scanning
    // the raw text for the first "{" would slice into the deliberation and
    // fail to parse — silently downgrading every utterance to the fallback.
    const raw = stripReasoning(rawWithReasoning);
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return FALLBACK;
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return resultSchema.parse(parsed);
  } catch {
    return FALLBACK;
  }
}
