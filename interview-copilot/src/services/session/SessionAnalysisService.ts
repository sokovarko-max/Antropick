import { z } from "zod";
import type { AIProvider } from "@/services/ai/types";
import { languageName, loadPrompt, type ResponseLanguage } from "@/services/prompts/PromptLoader";
import { stripReasoning } from "@/utils/parseAnswerFormat";
import type { AIResponseRecord, SessionAnalysis, TranscriptSegment } from "@/types";

const analysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  categoryScores: z.array(
    z.object({
      category: z.enum([
        "TECHNICAL",
        "COMMUNICATION",
        "STRUCTURE",
        "RELEVANCE",
        "CONFIDENCE",
        "EXPERIENCE",
        "PROBLEM_SOLVING",
      ]),
      score: z.number().min(0).max(100),
      evidence: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missedOpportunities: z.array(z.string()),
  redFlags: z.array(z.string()),
  bestAnswers: z.array(z.string()),
  weakestAnswers: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export class SessionAnalysisService {
  constructor(private readonly provider: AIProvider) {}

  async analyze(
    sessionId: string,
    transcript: TranscriptSegment[],
    aiResponses: AIResponseRecord[],
    responseLanguage: ResponseLanguage = "en",
  ): Promise<SessionAnalysis> {
    const transcriptText = transcript.map((s) => `[${s.speaker}] ${s.text}`).join("\n");
    const responsesText = aiResponses.map((r) => `Q-context prompt: ${r.prompt}\nSuggested: ${r.answer}`).join("\n---\n");

    const response = await this.provider.generate({
      taskType: "SESSION_ANALYSIS",
      systemPrompt: loadPrompt("analysis", {
        responseLanguage: languageName(responseLanguage),
      }),
      messages: [
        {
          role: "user",
          content: `Full transcript:\n${transcriptText}\n\nAI suggestions shown during the session:\n${responsesText}`,
        },
      ],
      responseLanguage,
    });

    // Same reason as QuestionDetector: braces inside a <think> block would
    // make this slice start in the middle of the model's deliberation.
    const text = stripReasoning(response.text);
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const parsed = analysisSchema.parse(JSON.parse(text.slice(jsonStart, jsonEnd + 1)));

    return { sessionId, ...parsed };
  }
}
