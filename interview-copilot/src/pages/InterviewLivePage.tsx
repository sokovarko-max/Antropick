import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppServices } from "@/services/runtime/useAppServices";
import { useSessionStore } from "@/stores/sessionStore";
import { useOverlayStore } from "@/stores/overlayStore";
import { RealtimePipeline } from "@/services/session/RealtimePipeline";
import { parseAnswerFormat } from "@/utils/parseAnswerFormat";
import { estimateCostUsd } from "@/services/session/CostMonitor";
import { OverlayPanel } from "@/components/OverlayPanel";
import { captureScreenshot } from "@/services/capture/screenshot";
import { useDesktopHotkeys } from "@/services/runtime/useDesktopHotkeys";
import type { AIResponseRecord, TranscriptSegment } from "@/types";

export function InterviewLivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const services = useAppServices();
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const appendAiResponse = useSessionStore((s) => s.appendAiResponse);
  const endSession = useSessionStore((s) => s.endSession);
  const documentChunks = useSessionStore((s) => s.documentChunks);

  const overlay = useOverlayStore();
  const [isListening, setIsListening] = useState(false);
  const pipelineRef = useRef<RealtimePipeline | null>(null);

  const pipeline = useMemo(() => {
    if (!session) return null;
    return new RealtimePipeline(session, services, {
      onSegment: (segment: TranscriptSegment) => appendTranscript(segment),
      onTriggerStart: (segment) => overlay.setQuestion(segment.text),
      onAnswerDelta: (delta) => overlay.appendAnswerDelta(delta),
      onAnswerComplete: ({ prompt, fullText, inputTokens, outputTokens, modelId }) => {
        const parsed = parseAnswerFormat(fullText);
        overlay.setAnswer(parsed.answer, parsed.keyPoints);
        const record: AIResponseRecord = {
          id: `resp_${Date.now()}`,
          sessionId: session.id,
          taskType: "REALTIME",
          prompt,
          answer: parsed.answer,
          keyPoints: parsed.keyPoints,
          createdAtMs: Date.now(),
          inputTokens,
          outputTokens,
          estimatedCostUsd: estimateCostUsd(modelId, { inputTokens, outputTokens }),
        };
        appendAiResponse(record);
      },
      onError: (message) => overlay.setError(message),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    pipelineRef.current = pipeline;
  }, [pipeline]);

  useEffect(() => {
    if (!session) return;
    const sessionChunks = documentChunks[session.id] ?? [];
    pipeline?.setDocumentChunks(
      sessionChunks.filter((c) => c.docType === "RESUME"),
      sessionChunks.filter((c) => c.docType === "JOB_DESCRIPTION"),
    );
  }, [pipeline, session, documentChunks]);

  useEffect(() => {
    const unsubscribe = services.sttProvider.onTranscript((event) => {
      void pipelineRef.current?.handleTranscriptSegment({
        speaker: event.speaker,
        text: event.text,
        timestampMs: event.timestampMs,
        confidence: event.confidence,
      });
    });
    return unsubscribe;
  }, [services.sttProvider]);

  async function handleToggleListening() {
    if (isListening) {
      await services.sttProvider.stop();
      setIsListening(false);
      overlay.setState("IDLE");
    } else {
      await services.sttProvider.start();
      setIsListening(true);
      overlay.setState("LISTENING");
    }
  }

  async function handleStop() {
    if (isListening) await services.sttProvider.stop();
    if (session) endSession(session.id);
    navigate(`/sessions/${sessionId}`);
  }

  /** Ctrl+B: capture the screen, send it to the vision model, show the answer. */
  async function handleScreenshot() {
    if (!session) return;
    overlay.setQuestion("Screenshot");
    try {
      const screenshot = await captureScreenshot();
      overlay.setQuestion(`Screenshot — ${screenshot.source}`);
      const answer = await services.visionService.analyze({
        imageBase64: screenshot.base64,
        mediaType: "image/png",
        recentTranscript: pipelineRef.current?.transcript.recentWindow(60_000) ?? [],
      });
      const parsed = parseAnswerFormat(answer);
      overlay.setAnswer(parsed.answer, parsed.keyPoints);
    } catch (error) {
      overlay.setError(
        error instanceof Error ? error.message : "Screenshot analysis failed",
      );
    }
  }

  useDesktopHotkeys({
    onAskAi: () => void pipelineRef.current?.respondToLatest(),
    onScreenshot: () => void handleScreenshot(),
    onPause: () => overlay.togglePause(),
    onHide: () => overlay.setVisible(!overlay.isVisible),
  });

  if (!session) {
    return <p className="text-sm text-ink-muted">Session not found.</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
      <div className="w-full">
        <h1 className="text-xl font-semibold text-ink">{session.title}</h1>
        <p className="text-sm text-ink-muted">{session.company}</p>
      </div>

      <div className="flex w-full gap-3">
        <button
          onClick={handleToggleListening}
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          {isListening ? "Stop listening" : "Start listening"}
        </button>
        <button
          onClick={handleStop}
          className="rounded-lg border border-surface-border px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-raised"
        >
          End Interview
        </button>
      </div>

      <OverlayPanel
        onAskAi={() => void pipelineRef.current?.respondToLatest()}
        onScreenshot={() => void handleScreenshot()}
        onTogglePause={() => overlay.togglePause()}
        onHide={() => overlay.setVisible(!overlay.isVisible)}
      />

      {services.isDemoMode && (
        <p className="text-center text-xs text-ink-faint">
          Demo mode: a scripted mock transcript plays every few seconds once you click "Start listening".
        </p>
      )}
    </div>
  );
}
