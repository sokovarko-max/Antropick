import { useSessionStore } from "@/stores/sessionStore";
import { t } from "@/i18n";

export function DocumentsPage() {
  const documentChunks = useSessionStore((s) => s.documentChunks);
  const sessions = useSessionStore((s) => s.sessions);

  const bySession = Object.entries(documentChunks);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink">{t("documents.title")}</h1>
      <p className="text-sm text-ink-muted">
        Documents are uploaded per-session from the New Interview screen (Resume, Job Description,
        Additional documents). This is a read-only overview of what's been indexed.
      </p>

      {bySession.length === 0 && <p className="text-sm text-ink-faint">No documents uploaded yet.</p>}

      {bySession.map(([sessionId, chunks]) => {
        const session = sessions.find((s) => s.id === sessionId);
        const grouped = groupBy(chunks, (c) => c.docType);
        return (
          <div key={sessionId} className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <p className="font-medium text-ink">{session?.title ?? "Unassigned upload"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(grouped).map(([docType, docChunks]) => (
                <span
                  key={docType}
                  className="rounded-full bg-surface-border px-2.5 py-1 text-xs text-ink-muted"
                >
                  {docType}: {docChunks.length} chunks
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
}
