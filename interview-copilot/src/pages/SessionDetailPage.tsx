import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSessionStore } from "@/stores/sessionStore";
import { useAppServices } from "@/services/runtime/useAppServices";
import { useTranslation } from "@/i18n/useTranslation";
import type { TranslationKey } from "@/i18n";
import type { ScoreCategory } from "@/types";

type Tab = "overview" | "transcript" | "answers" | "screenshots" | "analysis" | "chat";

const TABS: { id: Tab; labelKey: TranslationKey }[] = [
  { id: "overview", labelKey: "session.tabs.overview" },
  { id: "transcript", labelKey: "session.tabs.transcript" },
  { id: "answers", labelKey: "session.tabs.aiAnswers" },
  { id: "screenshots", labelKey: "session.tabs.screenshots" },
  { id: "analysis", labelKey: "session.tabs.analysis" },
  { id: "chat", labelKey: "session.tabs.chat" },
];

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [tab, setTab] = useState<Tab>("overview");

  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const transcript = useSessionStore((s) => s.transcripts[sessionId ?? ""] ?? []);
  const aiResponses = useSessionStore((s) => s.aiResponses[sessionId ?? ""] ?? []);
  const analysis = useSessionStore((s) => s.analyses[sessionId ?? ""]);
  const setAnalysis = useSessionStore((s) => s.setAnalysis);
  const services = useAppServices();
  const [analyzing, setAnalyzing] = useState(false);
  const { t } = useTranslation();

  if (!session || !sessionId) return <p className="text-sm text-ink-muted">Session not found.</p>;

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const result = await services.sessionAnalysisService.analyze(sessionId!, transcript, aiResponses);
      setAnalysis(result);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{session.title}</h1>
          <p className="text-sm text-ink-muted">{session.company}</p>
        </div>
        {!session.endTimeMs && (
          <Link
            to={`/sessions/${session.id}/live`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Resume
          </Link>
        )}
      </div>

      <div className="flex gap-1 border-b border-surface-border">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            onClick={() => setTab(tabDef.id)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === tabDef.id ? "border-b-2 border-accent text-accent" : "text-ink-muted"
            }`}
          >
            {t(tabDef.labelKey)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-2 text-sm text-ink-muted">
          <p>Role: {session.role || "—"}</p>
          <p>Mode: {session.mode}</p>
          <p>Framework: {session.framework}</p>
          <p>Response mode: {session.responseMode}</p>
          {session.summary && (
            <div>
              <p className="mt-4 font-medium text-ink">Summary</p>
              <p className="whitespace-pre-wrap">{session.summary}</p>
            </div>
          )}
        </div>
      )}

      {tab === "transcript" && (
        <div className="space-y-3">
          {transcript.length === 0 && <p className="text-sm text-ink-muted">No transcript yet.</p>}
          {transcript.map((segment) => (
            <div key={segment.id} className="text-sm">
              <span className="font-medium text-ink">{segment.speaker}:</span>{" "}
              <span className="text-ink-muted">{segment.text}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "answers" && (
        <div className="space-y-4">
          {aiResponses.length === 0 && <p className="text-sm text-ink-muted">No AI answers yet.</p>}
          {aiResponses.map((r) => (
            <div key={r.id} className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <p className="whitespace-pre-wrap text-sm text-ink">{r.answer}</p>
              {r.keyPoints.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                  {r.keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {/* Tokens are always known; a price is shown only when the
                  model that answered has a rate on file and that rate is not
                  zero. Demo answers and free-tier calls therefore say so
                  instead of displaying money that was never spent. */}
              <p className="mt-2 text-xs text-ink-faint">
                {t("session.tokensUsed", { count: String(r.inputTokens + r.outputTokens) })}
                {r.estimatedCostUsd === null
                  ? ` · ${t("session.costUnknown")}`
                  : r.estimatedCostUsd === 0
                    ? ` · ${t("session.costFree")}`
                    : ` · $${r.estimatedCostUsd.toFixed(4)}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "screenshots" && (
        <p className="text-sm text-ink-muted">
          No screenshots saved (Privacy Settings default to not persisting screenshots).
        </p>
      )}

      {tab === "analysis" && (
        <div className="space-y-4">
          {!analysis ? (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || transcript.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {analyzing ? "Analyzing…" : "Analyze Interview"}
            </button>
          ) : (
            <AnalysisView />
          )}
        </div>
      )}

      {tab === "chat" && <p className="text-sm text-ink-muted">Post-interview chat — coming in a follow-up pass.</p>}
    </div>
  );

  function AnalysisView() {
    if (!analysis) return null;
    return (
      <div className="space-y-4">
        <div className="text-3xl font-semibold text-accent">{analysis.overallScore}%</div>
        <div className="grid grid-cols-2 gap-2">
          {analysis.categoryScores.map((cs: { category: ScoreCategory; score: number; evidence: string }) => (
            <div key={cs.category} className="rounded-lg border border-surface-border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">{cs.category}</span>
                <span className="font-medium text-ink">{cs.score}</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">{cs.evidence}</p>
            </div>
          ))}
        </div>
        <ListSection title="Strengths" items={analysis.strengths} />
        <ListSection title="Weaknesses" items={analysis.weaknesses} />
        <ListSection title="Recommendations" items={analysis.recommendations} />
      </div>
    );
  }
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
