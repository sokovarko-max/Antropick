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

/**
 * Why the app is serving mock answers. The UI needs the distinction: "you
 * switched it on" is fixed in Settings > General, "no key" is fixed in
 * Settings > AI, and a banner that does not say which leaves the user with no
 * way to get out of demo mode.
 */
export type DemoModeReason = "EXPLICIT_SETTING" | "NO_API_KEY";

export interface AppServices {
  isDemoMode: boolean;
  demoModeReason: DemoModeReason | null;
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
  // The explicit setting is checked first so the banner names the switch the
  // user actually has to flip: with demo mode on, a perfectly good API key is
  // still ignored, and reporting "no API key" there would send them to fix
  // something that isn't broken.
  const demoModeReason: DemoModeReason | null = options.demoMode
    ? "EXPLICIT_SETTING"
    : !options.apiKey
      ? "NO_API_KEY"
      : null;
  const useDemoMode = demoModeReason !== null;

  const aiProvider: AIProvider = useDemoMode
    ? new MockAIProvider()
    : createAIProvider(options.providerId, options.apiKey!);

  const modelRouter = new ModelRouter([aiProvider], { providerId: options.providerId });
  const sttProvider: SpeechToTextProvider = new MockSTTProvider(); // real CloudSTTProvider wired in once a vendor key exists

  return {
    isDemoMode: useDemoMode,
    demoModeReason,
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
