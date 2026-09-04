import { Link } from "react-router-dom";
import { useSessionStore } from "@/stores/sessionStore";

export function SessionsPage() {
  const sessions = useSessionStore((s) => s.sessions);
  const analyses = useSessionStore((s) => s.analyses);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Sessions</h1>
        <Link
          to="/sessions/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          New Interview
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-ink-muted">No sessions yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {sessions.map((session) => {
            const analysis = analyses[session.id];
            const durationMin = session.endTimeMs
              ? Math.round((session.endTimeMs - session.startTimeMs) / 60000)
              : null;
            return (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="rounded-xl border border-surface-border bg-surface-raised p-4 hover:border-accent/40"
              >
                <div className="font-medium text-ink">{session.role || session.title}</div>
                <div className="text-sm text-ink-muted">{session.company}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-faint">
                  <span>{new Date(session.startTimeMs).toLocaleDateString()}</span>
                  <span>{durationMin !== null ? `${durationMin} min` : "in progress"}</span>
                  {analysis && <span className="font-medium text-accent">{analysis.overallScore}%</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
