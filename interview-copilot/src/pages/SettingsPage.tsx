import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { createAIProvider } from "@/services/runtime/AppServices";
import { AIProviderError, type AIErrorCode } from "@/services/ai/types";
import {
  apiKeyStorageKey,
  secureStoreDelete,
  secureStoreIsPersistent,
  secureStoreSet,
} from "@/services/security/secureStore";
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
  const [demoModeTurnedOff, setDemoModeTurnedOff] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storageIsPersistent, setStorageIsPersistent] = useState(true);
  const { t } = useTranslation();
  const keyIsStored = settings.apiKeyPresent[settings.aiProvider];

  useEffect(() => {
    // Checked rather than assumed: a build whose credential store is in-memory
    // accepts a key and loses it at exit, and telling the user it was saved is
    // worse than telling them it can't be.
    void secureStoreIsPersistent().then(setStorageIsPersistent);
  }, []);

  /**
   * Persists the key and clears whatever was standing in the way of using it.
   * Demo mode defaults to on and is persisted, so a stored key alone still
   * produces canned answers — that is the "I added a key and nothing changed"
   * report.
   */
  async function storeKey(): Promise<void> {
    await secureStoreSet(apiKeyStorageKey(settings.aiProvider), apiKeyInput);
    settings.setApiKeyPresent(settings.aiProvider, true);
    setApiKeyInput("");
    if (settings.demoMode) {
      settings.setDemoMode(false);
      setDemoModeTurnedOff(true);
    }
  }

  /**
   * Saves without calling the vendor. Requiring a successful live test to
   * persist anything meant a user whose account was rate-limited, out of
   * credit, or behind a flaky network could not save a valid key at all.
   */
  async function handleSaveKey() {
    setTesting(true);
    setConnectionError(null);
    setDemoModeTurnedOff(false);
    setSaved(false);
    try {
      await storeKey();
      setSaved(true);
    } catch (error) {
      setConnectionError({
        code: "UNKNOWN",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleRemoveKey() {
    await secureStoreDelete(apiKeyStorageKey(settings.aiProvider));
    settings.setApiKeyPresent(settings.aiProvider, false);
    settings.setConnectionStatus("UNKNOWN");
    setSaved(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setConnectionError(null);
    setDemoModeTurnedOff(false);
    setSaved(false);
    settings.setConnectionStatus("UNKNOWN");
    try {
      // Validate before storing: writing first meant a typo'd key overwrote a
      // working one that was already in the OS keychain.
      const provider = createAIProvider(settings.aiProvider, apiKeyInput);
      await provider.generate({
        taskType: "CHAT",
        systemPrompt: "Reply with exactly: OK",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      // A key that just answered a live request is unambiguous intent to stop
      // using mock answers, so storeKey also clears the demo-mode switch.
      await storeKey();
      settings.setConnectionStatus("CONNECTED");
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

            {!storageIsPersistent && (
              <p className="rounded-lg bg-state-error/10 px-3 py-2 text-sm text-state-error">
                {t("settings.ai.storageNotPersistent")}
              </p>
            )}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">{t("settings.ai.apiKey")}</span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="input"
                // A stored key is never read back into the field — the
                // placeholder is the only thing that reports it, so the real
                // secret stays out of the DOM.
                placeholder={
                  keyIsStored
                    ? t("settings.ai.keyStoredPlaceholder")
                    : settings.aiProvider === "groq"
                      ? "gsk_..."
                      : "sk-ant-..."
                }
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testing || !apiKeyInput}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {testing ? t("settings.ai.testing") : t("settings.ai.testConnection")}
              </button>
              <button
                onClick={handleSaveKey}
                disabled={testing || !apiKeyInput}
                className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-raised disabled:opacity-50"
              >
                {t("settings.ai.saveWithoutTesting")}
              </button>
              {keyIsStored && (
                <button
                  onClick={() => void handleRemoveKey()}
                  className="rounded-lg px-3 py-2 text-sm text-state-error hover:bg-state-error/10"
                >
                  {t("settings.ai.removeKey")}
                </button>
              )}
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
            {keyIsStored && (
              <p className="text-sm text-state-listening">
                ● {t("settings.ai.keyStored", { provider: PROVIDERS[settings.aiProvider].label })}
              </p>
            )}
            {saved && (
              <p className="rounded-lg bg-state-listening/10 px-3 py-2 text-sm text-state-listening">
                {t("settings.ai.keySaved")}
              </p>
            )}
            {demoModeTurnedOff && (
              <p className="rounded-lg bg-state-listening/10 px-3 py-2 text-sm text-state-listening">
                {t("settings.ai.demoModeTurnedOff")}
              </p>
            )}
            {settings.demoMode && (
              <p className="rounded-lg bg-state-thinking/10 px-3 py-2 text-sm text-state-thinking">
                {t("settings.ai.demoModeOverridesKey")}
              </p>
            )}
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
                  {t("settings.appearance.windowOpacity")}
                </span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {Math.round(settings.windowOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                step={5}
                value={Math.round(settings.windowOpacity * 100)}
                onChange={(e) => settings.setWindowOpacity(Number(e.target.value) / 100)}
                className="w-full accent-accent"
              />
              <p className="text-xs text-ink-faint">
                {t("settings.appearance.windowOpacityHint")}
              </p>
            </div>

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
