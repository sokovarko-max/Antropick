import { Link } from "react-router-dom";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranslation } from "@/i18n/useTranslation";

export function DashboardPage() {
  const sessions = useSessionStore((s) => s.sessions);
  const aiResponses = useSessionStore((s) => s.aiResponses);
  const analyses = useSessionStore((s) => s.analyses);
  const { t } = useTranslation();

  const totalQuestions = Object.values(aiResponses).reduce((sum, list) => sum + list.length, 0);
  const scores = Object.values(analyses).map((a) => a.overallScore);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const lastSession = sessions[0];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">{t("dashboard.welcome")}</h1>
        <Link
          to="/sessions/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          {t("dashboard.newInterview")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t("dashboard.stats.interviews")} value={sessions.length} />
        <StatCard label={t("dashboard.stats.questions")} value={totalQuestions} />
        <StatCard
          label={t("dashboard.stats.averageScore")}
          value={averageScore !== null ? `${averageScore}%` : "—"}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">
          {t("dashboard.recentSessions")}
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-muted">No sessions yet — start your first interview.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="block rounded-xl border border-surface-border bg-surface-raised p-4 hover:border-accent/40"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-ink">{session.title || session.role}</div>
                    <div className="text-sm text-ink-muted">{session.company}</div>
                  </div>
                  {analyses[session.id] && (
                    <div className="text-sm font-medium text-accent">
                      {analyses[session.id]!.overallScore}%
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {lastSession && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">
            {t("dashboard.lastSession")}
          </h2>
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4 text-sm text-ink-muted">
            {lastSession.title || lastSession.role} — {new Date(lastSession.startTimeMs).toLocaleString()}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}
