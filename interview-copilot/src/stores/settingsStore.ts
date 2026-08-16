import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InterviewFramework, ResponseMode } from "@/types";
import type { Locale } from "@/i18n";

export interface HotkeyBindings {
  askAi: string;
  screenshot: string;
  hide: string;
  pause: string;
}

export interface PrivacySettings {
  saveTranscript: boolean;
  saveScreenshots: boolean;
  saveAudio: boolean;
  cloudProcessing: boolean;
}

export interface CostLimitSettings {
  dailyLimitUsd: number;
  sessionLimitUsd: number;
  warningThreshold: number;
}

export interface SettingsState {
  demoMode: boolean;
  /** Whether an Anthropic key exists in secure storage — never the key itself. */
  anthropicApiKeyPresent: boolean;
  connectionStatus: "UNKNOWN" | "CONNECTED" | "DISCONNECTED";
  locale: Locale;
  responseMode: ResponseMode;
  framework: InterviewFramework;
  hotkeys: HotkeyBindings;
  privacy: PrivacySettings;
  costLimits: CostLimitSettings;
  hasCompletedOnboarding: boolean;

  setDemoMode: (value: boolean) => void;
  setAnthropicApiKeyPresent: (value: boolean) => void;
  setConnectionStatus: (status: SettingsState["connectionStatus"]) => void;
  setLocale: (locale: Locale) => void;
  setResponseMode: (mode: ResponseMode) => void;
  setFramework: (framework: InterviewFramework) => void;
  setHotkey: (action: keyof HotkeyBindings, combo: string) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
  setCostLimits: (patch: Partial<CostLimitSettings>) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      demoMode: true,
      anthropicApiKeyPresent: false,
      connectionStatus: "UNKNOWN",
      locale: "en",
      responseMode: "SHORT",
      framework: "NONE",
      hotkeys: {
        askAi: "Ctrl+Q",
        screenshot: "Ctrl+B",
        hide: "Ctrl+Shift+H",
        pause: "Ctrl+Shift+P",
      },
      privacy: {
        saveTranscript: true,
        saveScreenshots: false,
        saveAudio: false,
        cloudProcessing: true,
      },
      costLimits: { dailyLimitUsd: 10, sessionLimitUsd: 2, warningThreshold: 0.8 },
      hasCompletedOnboarding: false,

      setDemoMode: (value) => set({ demoMode: value }),
      setAnthropicApiKeyPresent: (value) => set({ anthropicApiKeyPresent: value }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setLocale: (locale) => set({ locale }),
      setResponseMode: (mode) => set({ responseMode: mode }),
      setFramework: (framework) => set({ framework }),
      setHotkey: (action, combo) =>
        set((s) => ({ hotkeys: { ...s.hotkeys, [action]: combo } })),
      setPrivacy: (patch) => set((s) => ({ privacy: { ...s.privacy, ...patch } })),
      setCostLimits: (patch) => set((s) => ({ costLimits: { ...s.costLimits, ...patch } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    { name: "interview-copilot-settings" },
  ),
);

export type { Locale };
