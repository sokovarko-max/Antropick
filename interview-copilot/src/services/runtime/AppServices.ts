import { AnthropicProvider } from "@/services/ai/AnthropicProvider";
import { OpenAICompatibleProvider } from "@/services/ai/OpenAICompatibleProvider";
import { MockAIProvider } from "@/services/ai/MockAIProvider";
import { ModelRouter } from "@/services/ai/ModelRouter";
import type { AIProvider } from "@/services/ai/types";
import { PROVIDERS, type ProviderId } from "@/config/models";
import { MockSTTProvider } from "@/services/stt/MockSTTProvider";
import type { SpeechToTextProvider } from "@/services/stt/types";
import { QuestionDetector } from "@/services/questionDetector/QuestionDetector";
import { ContextEngine } from "@/services/context/ContextEngine";
import { MemoryManager } from "@/services/memory/MemoryManager";
import { VisionService } from "@/services/vision/VisionService";
import { SessionAnalysisService } from "@/services/session/SessionAnalysisService";

export interface AppServices {
  isDemoMode: boolean;
  providerId: ProviderId;
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
  providerId: ProviderId;
  apiKey: string | null;
}

/**
 * Builds the concrete provider for a vendor. Anthropic has its own SDK;
 * everything else this app talks to speaks OpenAI's chat/completions, so one
 * implementation with a configurable base URL covers Groq today and
 * OpenRouter/Ollama unchanged later.
 */
export function createAIProvider(providerId: ProviderId, apiKey: string): AIProvider {
  if (providerId === "anthropic") {
    return new AnthropicProvider({ apiKey });
  }
  const descriptor = PROVIDERS[providerId];
  if (!descriptor.baseUrl) {
    throw new Error(`Provider ${providerId} has no base URL configured`);
  }
  return new OpenAICompatibleProvider({ providerId, apiKey, baseUrl: descriptor.baseUrl });
}

/**
 * Composition root for the service layer. UI code should get services from
 * here (via the React context in AppServicesProvider) rather than
 * constructing providers itself — keeps DEMO_MODE and the vendor choice a
 * single switch instead of scattered conditionals.
 */
export function buildAppServices(options: BuildServicesOptions): AppServices {
  const useDemoMode = options.demoMode || !options.apiKey;

  const aiProvider: AIProvider = useDemoMode
    ? new MockAIProvider()
    : createAIProvider(options.providerId, options.apiKey!);

  const modelRouter = new ModelRouter([aiProvider], { providerId: options.providerId });
  const sttProvider: SpeechToTextProvider = new MockSTTProvider(); // real CloudSTTProvider wired in once a vendor key exists

  return {
    isDemoMode: useDemoMode,
    providerId: options.providerId,
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
