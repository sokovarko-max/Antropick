import { AnthropicProvider } from "@/services/ai/AnthropicProvider";
import { MockAIProvider } from "@/services/ai/MockAIProvider";
import { ModelRouter } from "@/services/ai/ModelRouter";
import type { AIProvider } from "@/services/ai/types";
import { MockSTTProvider } from "@/services/stt/MockSTTProvider";
import type { SpeechToTextProvider } from "@/services/stt/types";
import { QuestionDetector } from "@/services/questionDetector/QuestionDetector";
import { ContextEngine } from "@/services/context/ContextEngine";
import { MemoryManager } from "@/services/memory/MemoryManager";
import { VisionService } from "@/services/vision/VisionService";
import { SessionAnalysisService } from "@/services/session/SessionAnalysisService";

export interface AppServices {
  isDemoMode: boolean;
  aiProvider: AIProvider;
  modelRouter: ModelRouter;
  sttProvider: SpeechToTextProvider;
  questionDetector: QuestionDetector;
  contextEngine: ContextEngine;
  memoryManager: MemoryManager;
  visionService: VisionService;
  sessionAnalysisService: SessionAnalysisService;
}

export interface BuildServicesOptions {
  demoMode: boolean;
  anthropicApiKey: string | null;
}

/**
 * Composition root for the service layer. UI code should get services from
 * here (via the React context in AppServicesProvider) rather than
 * constructing AnthropicProvider/etc. itself — keeps DEMO_MODE a single
 * switch instead of scattered conditionals.
 */
export function buildAppServices(options: BuildServicesOptions): AppServices {
  const useDemoMode = options.demoMode || !options.anthropicApiKey;

  const aiProvider: AIProvider = useDemoMode
    ? new MockAIProvider()
    : new AnthropicProvider({ apiKey: options.anthropicApiKey! });

  const modelRouter = new ModelRouter([aiProvider]);
  const sttProvider: SpeechToTextProvider = new MockSTTProvider(); // real CloudSTTProvider wired in once a vendor key exists

  return {
    isDemoMode: useDemoMode,
    aiProvider,
    modelRouter,
    sttProvider,
    questionDetector: new QuestionDetector(aiProvider),
    contextEngine: new ContextEngine(),
    memoryManager: new MemoryManager(aiProvider),
    visionService: new VisionService(aiProvider),
    sessionAnalysisService: new SessionAnalysisService(aiProvider),
  };
}
