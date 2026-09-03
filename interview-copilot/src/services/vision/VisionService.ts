import type { AIProvider } from "@/services/ai/types";
import { languageName, loadPrompt, type ResponseLanguage } from "@/services/prompts/PromptLoader";
import type { TranscriptSegment } from "@/types";

export interface AnalyzeScreenshotInput {
  imageBase64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  recentTranscript: TranscriptSegment[];
  /**
   * Taken from the session rather than the UI locale, so a screenshot answer
   * comes back in the same language as the spoken-question answers beside it.
   */
  responseLanguage: ResponseLanguage;
}

export class VisionService {
  constructor(private readonly provider: AIProvider) {}

  async analyze(input: AnalyzeScreenshotInput): Promise<string> {
    const transcriptText = input.recentTranscript.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    const response = await this.provider.analyzeImage({
      taskType: "VISION",
      systemPrompt: loadPrompt("vision", {
        responseLanguage: languageName(input.responseLanguage),
      }),
      messages: [
        {
          role: "user",
          content: transcriptText
            ? `Recent conversation for context:\n${transcriptText}`
            : "No recent conversation context available.",
        },
      ],
      image: { base64: input.imageBase64, mediaType: input.mediaType },
      responseLanguage: input.responseLanguage,
    });
    return response.text;
  }
}
