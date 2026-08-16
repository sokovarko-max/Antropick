import type { AIProvider } from "@/services/ai/types";
import { loadPrompt } from "@/services/prompts/PromptLoader";
import type { TranscriptSegment } from "@/types";

export interface AnalyzeScreenshotInput {
  imageBase64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  recentTranscript: TranscriptSegment[];
}

export class VisionService {
  constructor(private readonly provider: AIProvider) {}

  async analyze(input: AnalyzeScreenshotInput): Promise<string> {
    const transcriptText = input.recentTranscript.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    const response = await this.provider.analyzeImage({
      taskType: "VISION",
      systemPrompt: loadPrompt("vision"),
      messages: [
        {
          role: "user",
          content: transcriptText
            ? `Recent conversation for context:\n${transcriptText}`
            : "No recent conversation context available.",
        },
      ],
      image: { base64: input.imageBase64, mediaType: input.mediaType },
    });
    return response.text;
  }
}
