import { useOverlayStore } from "@/stores/overlayStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { StatusPill } from "./StatusPill";
import { useTranslation } from "@/i18n/useTranslation";

export interface OverlayPanelProps {
  onAskAi: () => void;
  onScreenshot: () => void;
  onTogglePause: () => void;
  onHide: () => void;
  /** Overrides the stored opacity — used by the Settings live preview. */
  opacityOverride?: number;
}

export function OverlayPanel({
  onAskAi,
  onScreenshot,
  onTogglePause,
  onHide,
  opacityOverride,
}: OverlayPanelProps) {
  const { t } = useTranslation();
  const { state, question, answer, keyPoints, errorMessage, isPaused, reset } = useOverlayStore();
  // Nothing else clears the panel: the last question and answer stayed on
  // screen until another one replaced it, so a one-off screenshot answer sat
  // there for the rest of the session.
  const hasContent = question !== null || answer !== "" || errorMessage !== null;
  const storedOpacity = useSettingsStore((s) => s.overlayOpacity);
  // The overlay window itself is transparent (see tauri.conf.json), so fading
  // the panel genuinely reveals the call behind it rather than blending into
  // an opaque window background.
  const opacity = opacityOverride ?? storedOpacity;

  return (
    <div
      style={{ opacity }}
      className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-surface-border bg-surface-overlay/95 p-4 shadow-2xl backdrop-blur transition-opacity"
    >
      <div className="flex items-center justify-between">
        <StatusPill state={state} />
        <div className="flex gap-1.5">
          <button
            onClick={onAskAi}
            className="rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/25"
          >
            {t("overlay.action.askAi")}
          </button>
          <button
            onClick={onScreenshot}
            className="rounded-lg bg-surface-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-border/70"
          >
            {t("overlay.action.screenshot")}
          </button>
          <button
            onClick={onTogglePause}
            className="rounded-lg bg-surface-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-border/70"
          >
            {isPaused ? "▶" : t("overlay.action.pause")}
          </button>
          {hasContent && (
            <button
              onClick={reset}
              title={t("overlay.action.clear")}
              aria-label={t("overlay.action.clear")}
              className="rounded-lg bg-surface-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-border/70"
            >
              ✕
            </button>
          )}
          <button
            onClick={onHide}
            className="rounded-lg bg-surface-border px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-border/70"
          >
            {t("overlay.action.hide")}
          </button>
        </div>
      </div>

      {question && (
        <div className="text-sm text-ink-muted">
          <span className="font-medium text-ink">Q:</span> {question}
        </div>
      )}

      {state === "ERROR" && errorMessage && (
        <div className="rounded-lg bg-state-error/10 px-3 py-2 text-sm text-state-error">
          {errorMessage}
        </div>
      )}

      {answer && (
        <div className="text-sm leading-relaxed text-ink whitespace-pre-wrap">{answer}</div>
      )}

      {keyPoints.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {keyPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
