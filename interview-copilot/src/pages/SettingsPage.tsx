import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { AnthropicProvider } from "@/services/ai/AnthropicProvider";
import { ANTHROPIC_API_KEY_STORAGE_KEY, secureStoreSet } from "@/services/security/secureStore";
import { t } from "@/i18n";

const SECTIONS = ["general", "ai", "audio", "appearance", "hotkeys", "privacy", "storage", "advanced"] as const;
type Section = (typeof SECTIONS)[number];

export function SettingsPage() {
  const [section, setSection] = useState<Section>("general");
  const settings = useSettingsStore();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  async function handleTestConnection() {
    setTesting(true);
    setConnectionError(null);
    settings.setConnectionStatus("UNKNOWN");
    try {
      await secureStoreSet(ANTHROPIC_API_KEY_STORAGE_KEY, apiKeyInput);
      const provider = new AnthropicProvider({ apiKey: apiKeyInput });
      await provider.generate({
        taskType: "CHAT",
        systemPrompt: "Reply with exactly: OK",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      settings.setConnectionStatus("CONNECTED");
      settings.setAnthropicApiKeyPresent(true);
    } catch (error) {
      // Surface the real reason — a silent "not connected" with no detail is
      // exactly what let a real bug (SDK refusing to run in a WebView) go
      // unnoticed. See docs/security.md: no silent failures.
      settings.setConnectionStatus("DISCONNECTED");
      setConnectionError(error instanceof Error ? error.message : String(error));
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
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm capitalize ${
              section === s ? "bg-accent/15 text-accent" : "text-ink-muted hover:bg-surface-raised"
            }`}
          >
            {t(`settings.${s}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-6">
        <h1 className="text-2xl font-semibold text-ink">{t("settings.title")}</h1>

        {section === "general" && (
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-raised p-4">
              <div>
                <p className="text-sm font-medium text-ink">Demo mode</p>
                <p className="text-xs text-ink-muted">Use mock AI/STT — no API key required</p>
              </div>
              <input
                type="checkbox"
                checked={settings.demoMode}
                onChange={(e) => settings.setDemoMode(e.target.checked)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink-muted">Language</span>
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
              <span className="text-sm font-medium text-ink-muted">{t("settings.ai.apiKey")}</span>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="input"
                placeholder="sk-ant-..."
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testing || !apiKeyInput}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {testing ? "Testing…" : t("settings.ai.testConnection")}
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
              <p className="rounded-lg bg-state-error/10 px-3 py-2 text-sm text-state-error">
                {connectionError}
              </p>
            )}
            <p className="text-xs text-ink-faint">
              The key is stored in OS secure storage only — never in the database or a plain settings
              file. See docs/security.md.
            </p>
          </div>
        )}

        {section === "audio" && (
          <p className="text-sm text-ink-muted">
            Microphone/system-audio device selection requires the desktop (Tauri) build — not available
            in the browser dev server.
          </p>
        )}

        {section === "appearance" && (
          <p className="text-sm text-ink-muted">Dark theme only in this scaffold.</p>
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
