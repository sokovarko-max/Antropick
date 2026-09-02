import type { OverlayState } from "@/types";
import { useTranslation } from "@/i18n/useTranslation";
import type { TranslationKey } from "@/i18n";

const STATE_STYLES: Record<OverlayState, string> = {
  IDLE: "bg-ink-faint/20 text-ink-muted",
  LISTENING: "bg-state-listening/15 text-state-listening",
  THINKING: "bg-state-thinking/15 text-state-thinking",
  ANSWERING: "bg-state-answering/15 text-state-answering",
  ERROR: "bg-state-error/15 text-state-error",
};

const STATE_LABEL_KEYS: Record<OverlayState, TranslationKey> = {
  IDLE: "overlay.status.idle",
  LISTENING: "overlay.status.listening",
  THINKING: "overlay.status.thinking",
  ANSWERING: "overlay.status.answering",
  ERROR: "overlay.status.error",
};

export function StatusPill({ state }: { state: OverlayState }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLES[state]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(STATE_LABEL_KEYS[state])}
    </span>
  );
}
