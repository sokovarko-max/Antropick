import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InterviewFramework, ResponseMode } from "@/types";
import type { ProviderId } from "@/config/models";
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
  /** Which vendor the app talks to. */
  aiProvider: ProviderId;
  /** Which providers have a key in secure storage — never the keys themselves. */
  apiKeyPresent: Record<ProviderId, boolean>;
  connectionStatus: "UNKNOWN" | "CONNECTED" | "DISCONNECTED";
  locale: Locale;
  responseMode: ResponseMode;
  framework: InterviewFramework;
  /** Opacity of the floating overlay panel, 0.3–1. */
  overlayOpacity: number;
  /** Translucency of the main window itself, 0.3–1 (Windows only). */
  windowOpacity: number;
  hotkeys: HotkeyBindings;
  privacy: PrivacySettings;
  costLimits: CostLimitSettings;
  hasCompletedOnboarding: boolean;

  setDemoMode: (value: boolean) => void;
  setAiProvider: (provider: ProviderId) => void;
  setApiKeyPresent: (provider: ProviderId, value: boolean) => void;
  setConnectionStatus: (status: SettingsState["connectionStatus"]) => void;
  setLocale: (locale: Locale) => void;
  setResponseMode: (mode: ResponseMode) => void;
  setOverlayOpacity: (opacity: number) => void;
  setWindowOpacity: (opacity: number) => void;
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
      aiProvider: "groq",
      apiKeyPresent: { anthropic: false, groq: false },
      connectionStatus: "UNKNOWN",
      locale: "en",
      responseMode: "SHORT",
      framework: "NONE",
      overlayOpacity: 1,
      windowOpacity: 1,
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
      setAiProvider: (provider) => set({ aiProvider: provider, connectionStatus: "UNKNOWN" }),
      setApiKeyPresent: (provider, value) =>
        set((s) => ({ apiKeyPresent: { ...s.apiKeyPresent, [provider]: value } })),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setLocale: (locale) => set({ locale }),
      setResponseMode: (mode) => set({ responseMode: mode }),
      // Clamped so the panel can never be made invisible (and therefore
      // impossible to find and fix) by dragging the slider to zero.
      setOverlayOpacity: (opacity) =>
        set({ overlayOpacity: Math.min(1, Math.max(0.3, opacity)) }),
      // Same floor as the overlay, and for the same reason: a window faded to
      // nothing cannot be found again to undo the setting.
      setWindowOpacity: (opacity) =>
        set({ windowOpacity: Math.min(1, Math.max(0.3, opacity)) }),
      setFramework: (framework) => set({ framework }),
      setHotkey: (action, combo) =>
        set((s) => ({ hotkeys: { ...s.hotkeys, [action]: combo } })),
      setPrivacy: (patch) => set((s) => ({ privacy: { ...s.privacy, ...patch } })),
      setCostLimits: (patch) => set((s) => ({ costLimits: { ...s.costLimits, ...patch } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "interview-copilot-settings",
      version: 1,
      /**
       * v0 stored a single `anthropicApiKeyPresent` flag, from before the app
       * supported more than one vendor. Zustand's default merge is shallow,
       * so without this an upgraded install keeps that dead key and lands on
       * `apiKeyPresent: { anthropic: false, ... }` — the app then reports no
       * key, silently falls back to mock answers, and the user sees an
       * install that "won't leave demo mode".
       */
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState> & {
          anthropicApiKeyPresent?: boolean;
        };
        if (version >= 1) return state as SettingsState;
        const { anthropicApiKeyPresent, ...rest } = state;
        return {
          ...rest,
          apiKeyPresent: {
            anthropic: anthropicApiKeyPresent ?? false,
            groq: false,
          },
          // v0 predates provider choice; it could only have been Anthropic.
          aiProvider: anthropicApiKeyPresent ? "anthropic" : (rest.aiProvider ?? "groq"),
        } as SettingsState;
      },
    },
  ),
);

export type { Locale };
