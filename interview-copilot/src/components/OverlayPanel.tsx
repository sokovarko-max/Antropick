import { useOverlayStore } from "@/stores/overlayStore";
import { StatusPill } from "./StatusPill";
import { t } from "@/i18n";

export interface OverlayPanelProps {
  onAskAi: () => void;
  onScreenshot: () => void;
  onTogglePause: () => void;
  onHide: () => void;
}

export function OverlayPanel({ onAskAi, onScreenshot, onTogglePause, onHide }: OverlayPanelProps) {
  const { state, question, answer, keyPoints, errorMessage, isPaused } = useOverlayStore();

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-surface-border bg-surface-overlay/95 p-4 shadow-2xl backdrop-blur">
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
