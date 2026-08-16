import { z } from "zod";
import type { AIProvider } from "@/services/ai/types";
import { loadPrompt } from "@/services/prompts/PromptLoader";
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
  ): Promise<SessionAnalysis> {
    const transcriptText = transcript.map((s) => `[${s.speaker}] ${s.text}`).join("\n");
    const responsesText = aiResponses.map((r) => `Q-context prompt: ${r.prompt}\nSuggested: ${r.answer}`).join("\n---\n");

    const response = await this.provider.generate({
      taskType: "SESSION_ANALYSIS",
      systemPrompt: loadPrompt("analysis"),
      messages: [
        {
          role: "user",
          content: `Full transcript:\n${transcriptText}\n\nAI suggestions shown during the session:\n${responsesText}`,
        },
      ],
    });

    const jsonStart = response.text.indexOf("{");
    const jsonEnd = response.text.lastIndexOf("}");
    const parsed = analysisSchema.parse(JSON.parse(response.text.slice(jsonStart, jsonEnd + 1)));

    return { sessionId, ...parsed };
  }
}
