import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { createAIProvider } from "@/services/runtime/AppServices";
import { AIProviderError, type AIErrorCode } from "@/services/ai/types";
import { apiKeyStorageKey, secureStoreSet } from "@/services/security/secureStore";
import { MODEL_PROFILES, PROVIDERS, type ProviderId } from "@/config/models";
import { OverlayPanel } from "@/components/OverlayPanel";
import { useTranslation } from "@/i18n/useTranslation";
import type { TranslationKey } from "@/i18n";

const SECTIONS = ["general", "ai", "audio", "appearance", "hotkeys", "privacy", "storage", "advanced"] as const;
type Section = (typeof SECTIONS)[number];

export function SettingsPage() {
  const [section, setSection] = useState<Section>("general");
  const settings = useSettingsStore();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [connectionError, setConnectionError] = useState<{
    code: AIErrorCode;
    detail: string;
  } | null>(null);
  const { t } = useTranslation();

  async function handleTestConnection() {
    setTesting(true);
    setConnectionError(null);
    settings.setConnectionStatus("UNKNOWN");
    try {
      await secureStoreSet(apiKeyStorageKey(settings.aiProvider), apiKeyInput);
      const provider = createAIProvider(settings.aiProvider, apiKeyInput);
      await provider.generate({
        taskType: "CHAT",
        systemPrompt: "Reply with exactly: OK",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      settings.setConnectionStatus("CONNECTED");
      settings.setApiKeyPresent(settings.aiProvider, true);
    } catch (error) {
      // Surface the real reason — a silent "not connected" with no detail is
      // exactly what let a real bug (SDK refusing to run in a WebView) go
      // unnoticed. See docs/security.md: no silent failures. The vendor's raw
      // JSON body is kept, but behind a disclosure: it is a diagnostic, not
      // an explanation a user can act on.
      settings.setConnectionStatus("DISCONNECTED");
      setConnectionError({
        code: error instanceof AIProviderError ? error.code : "UNKNOWN",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl gap-8">
      <nav className="w-40 shrink-0 space-y-1">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            // No `capitalize` here: the labels come from the dictionaries
            // already cased correctly, and title-casing every word is wrong
            // in Russian ("Внешний Вид" instead of "Внешний вид").
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
              section === s ? "bg-accent/15 text-accent" : "text-ink-muted hover:bg-surface-raised"
            }`}
          >
            {t(`settings.${s}` as TranslationKey)}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-6">
        <h1 className="text-2xl font-semibold text-ink">{t("settings.title")}</h1>

        {section === "general" && (
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-raised p-4">
              <div>
                <p className="text-sm font-medium text-ink">{t("settings.general.demoMode")}</p>
                <p className="text-xs text-ink-muted">{t("settings.general.demoModeHint")}</p>
              </div>
              <input
                type="checkbox"
                checked={settings.demoMode}
                onChange={(e) => settings.setDemoMode(e.target.checked)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">
                {t("settings.general.language")}
              </span>
              <select
                value={settings.locale}
                onChange={(e) => settings.setLocale(e.target.value as "en" | "ru")}
                className="input"
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </label>
          </div>
        )}

        {section === "ai" && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">{t("settings.ai.provider")}</span>
              <select
                value={settings.aiProvider}
                onChange={(e) => {
                  settings.setAiProvider(e.target.value as ProviderId);
                  setApiKeyInput("");
                  setConnectionError(null);
                }}
                className="input"
              >
                {Object.values(PROVIDERS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-xs text-ink-faint">
              {t(`settings.ai.hint.${settings.aiProvider}` as TranslationKey)}{" "}
              <span className="text-ink-muted">{PROVIDERS[settings.aiProvider].consoleUrl}</span>
            </p>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">{t("settings.ai.apiKey")}</span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="input"
                placeholder={settings.aiProvider === "groq" ? "gsk_..." : "sk-ant-..."}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testing || !apiKeyInput}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {testing ? t("settings.ai.testing") : t("settings.ai.testConnection")}
              </button>
              <span
                className={`text-sm ${
                  settings.connectionStatus === "CONNECTED" ? "text-state-listening" : "text-ink-muted"
                }`}
              >
                {settings.connectionStatus === "CONNECTED"
                  ? `● ${t("settings.ai.connected")}`
                  : settings.connectionStatus === "DISCONNECTED"
                    ? `● ${t("settings.ai.disconnected")}`
                    : ""}
              </span>
            </div>
            {connectionError && (
              <div className="space-y-2 rounded-lg bg-state-error/10 px-3 py-2">
                <p className="text-sm text-state-error">
                  {t(`aiError.${connectionError.code}` as TranslationKey, {
                    provider: PROVIDERS[settings.aiProvider].label,
                    console: PROVIDERS[settings.aiProvider].consoleUrl,
                  })}
                  {settings.aiProvider === "anthropic" &&
                    connectionError.code === "INSUFFICIENT_CREDITS" && (
                      <> {t("aiError.anthropicBillingNote")}</>
                    )}
                </p>
                <details className="text-xs text-ink-faint">
                  <summary className="cursor-pointer">{t("aiError.details")}</summary>
                  <p className="mt-1 break-all font-mono">{connectionError.detail}</p>
                </details>
              </div>
            )}
            <div className="space-y-1 rounded-lg border border-surface-border p-3">
              <p className="text-xs font-medium text-ink-muted">{t("settings.ai.modelsInUse")}</p>
              {(
                Object.entries(MODEL_PROFILES[settings.aiProvider]) as [string, { modelId: string }][]
              ).map(([task, profile]) => (
                <div key={task} className="flex justify-between text-xs">
                  <span className="text-ink-faint">{task}</span>
                  <span className="font-mono text-ink-muted">{profile.modelId}</span>
                </div>
              ))}
              {settings.aiProvider === "groq" && (
                <p className="pt-1 text-xs text-state-thinking">{t("settings.ai.groqVisionPreview")}</p>
              )}
            </div>

            <p className="text-xs text-ink-faint">{t("settings.ai.keyStorageNote")}</p>
          </div>
        )}

        {section === "audio" && (
          <p className="text-sm text-ink-muted">
            Microphone/system-audio device selection requires the desktop (Tauri) build — not available
            in the browser dev server.
          </p>
        )}

        {section === "appearance" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">
                  {t("settings.appearance.overlayOpacity")}
                </span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {Math.round(settings.overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={Math.round(settings.overlayOpacity * 100)}
                onChange={(e) => settings.setOverlayOpacity(Number(e.target.value) / 100)}
                className="w-full accent-accent"
              />
              <p className="text-xs text-ink-faint">
                {t("settings.appearance.overlayOpacityHint")}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-muted">
                {t("settings.appearance.preview")}
              </p>
              {/* Checkerboard stands in for whatever is behind the overlay, so
                  the effect is visible without starting a real session. */}
              <div
                className="flex justify-center rounded-xl p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #1b1f27 25%, transparent 25%, transparent 75%, #1b1f27 75%), linear-gradient(45deg, #1b1f27 25%, transparent 25%, transparent 75%, #1b1f27 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 8px 8px",
                  backgroundColor: "#0f1216",
                }}
              >
                <OverlayPanel
                  opacityOverride={settings.overlayOpacity}
                  onAskAi={() => {}}
                  onScreenshot={() => {}}
                  onTogglePause={() => {}}
                  onHide={() => {}}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-muted">{t("settings.appearance.theme")}</p>
              <p className="text-sm text-ink-muted">{t("settings.appearance.themeDarkOnly")}</p>
            </div>
          </div>
        )}

        {section === "hotkeys" && (
          <div className="space-y-3">
            {Object.entries(settings.hotkeys).map(([action, combo]) => (
              <label key={action} className="flex items-center justify-between">
                <span className="text-sm text-ink-muted capitalize">{action}</span>
                <input
                  value={combo}
                  onChange={(e) =>
                    settings.setHotkey(action as keyof typeof settings.hotkeys, e.target.value)
                  }
                  className="input w-40"
                />
              </label>
            ))}
          </div>
        )}

        {section === "privacy" && (
          <div className="space-y-3">
            {(
              [
                ["saveTranscript", "settings.privacy.saveTranscript"],
                ["saveScreenshots", "settings.privacy.saveScreenshots"],
                ["saveAudio", "settings.privacy.saveAudio"],
                ["cloudProcessing", "settings.privacy.cloudProcessing"],
              ] as const
            ).map(([key, labelKey]) => (
              <label key={key} className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-raised p-4">
                <span className="text-sm text-ink">{t(labelKey)}</span>
                <input
                  type="checkbox"
                  checked={settings.privacy[key]}
                  onChange={(e) => settings.setPrivacy({ [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
        )}

        {section === "storage" && (
          <p className="text-sm text-ink-muted">SQLite database location managed by the Rust backend.</p>
        )}

        {section === "advanced" && (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">Daily cost limit (USD)</span>
              <input
                type="number"
                value={settings.costLimits.dailyLimitUsd}
                onChange={(e) => settings.setCostLimits({ dailyLimitUsd: Number(e.target.value) })}
                className="input"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">Session cost limit (USD)</span>
              <input
                type="number"
                value={settings.costLimits.sessionLimitUsd}
                onChange={(e) => settings.setCostLimits({ sessionLimitUsd: Number(e.target.value) })}
                className="input"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
