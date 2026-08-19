import { create } from "zustand";
import { getPersistenceAdapter } from "@/services/persistence";
import { useSettingsStore } from "./settingsStore";
import { createLogger } from "@/utils/logger";
import type {
  AIResponseRecord,
  DocumentChunk,
  InterviewFramework,
  ResponseMode,
  Session,
  SessionAnalysis,
  SessionMode,
  TranscriptSegment,
  UploadedDocument,
} from "@/types";

const log = createLogger("sessionStore");

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

export interface NewSessionInput {
  title: string;
  role: string;
  company: string;
  mode: SessionMode;
  responseLanguage: "en" | "ru";
  responseMode: ResponseMode;
  framework: InterviewFramework;
  userInstructions: string;
}

/** A document uploaded on the New Interview screen, before a session exists. */
export interface PendingUpload {
  document: UploadedDocument;
  chunks: DocumentChunk[];
}

interface SessionState {
  sessions: Session[];
  transcripts: Record<string, TranscriptSegment[]>;
  aiResponses: Record<string, AIResponseRecord[]>;
  documentChunks: Record<string, DocumentChunk[]>;
  analyses: Record<string, SessionAnalysis>;
  activeSessionId: string | null;
  pendingUploads: PendingUpload[];
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  createSession: (input: NewSessionInput) => Session;
  endSession: (sessionId: string) => void;
  setSummary: (sessionId: string, summary: string) => void;
  appendTranscript: (segment: TranscriptSegment) => void;
  appendAiResponse: (record: AIResponseRecord) => void;
  addPendingUpload: (upload: PendingUpload) => void;
  addDocumentToSession: (sessionId: string, upload: PendingUpload) => void;
  setAnalysis: (analysis: SessionAnalysis) => void;
  setActiveSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => void;
}

/**
 * Writes go to memory first (so the live interview UI never waits on disk),
 * then to the persistence adapter. A failed write is logged, never thrown —
 * losing one transcript row must not take down a running session.
 */
function persist(operation: string, run: () => Promise<void>): void {
  void run().catch((error) => log.error(`persist ${operation} failed`, { error: String(error) }));
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  sessions: [],
  transcripts: {},
  aiResponses: {},
  documentChunks: {},
  analyses: {},
  activeSessionId: null,
  pendingUploads: [],
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const state = await getPersistenceAdapter().loadAll();
      set({
        sessions: state.sessions,
        transcripts: state.transcripts,
        aiResponses: state.aiResponses,
        documentChunks: state.documentChunks,
        analyses: state.analyses,
        isHydrated: true,
      });
    } catch (error) {
      // Starting with an empty history is better than a blank screen.
      log.error("hydrate failed, starting empty", { error: String(error) });
      set({ isHydrated: true });
    }
  },

  createSession: (input) => {
    const session: Session = {
      id: nextId("session"),
      title: input.title,
      role: input.role,
      company: input.company,
      startTimeMs: Date.now(),
      endTimeMs: null,
      mode: input.mode,
      modelProfileOverride: null,
      responseLanguage: input.responseLanguage,
      responseMode: input.responseMode,
      framework: input.framework,
      userInstructions: input.userInstructions,
      summary: null,
    };

    // Documents uploaded before the session existed are re-keyed onto it now,
    // then persisted — the session row must exist first, since documents and
    // document_chunks both have a foreign key onto it.
    const pending = get().pendingUploads;
    const attached: PendingUpload[] = pending.map(({ document, chunks }) => ({
      document: { ...document, sessionId: session.id },
      chunks: chunks.map((chunk) => ({ ...chunk, sessionId: session.id })),
    }));
    const attachedChunks = attached.flatMap((upload) => upload.chunks);

    set((s) => ({
      sessions: [session, ...s.sessions],
      transcripts: { ...s.transcripts, [session.id]: [] },
      aiResponses: { ...s.aiResponses, [session.id]: [] },
      documentChunks: { ...s.documentChunks, [session.id]: attachedChunks },
      activeSessionId: session.id,
      pendingUploads: [],
    }));

    persist("createSession", async () => {
      const adapter = getPersistenceAdapter();
      await adapter.saveSession(session);
      for (const upload of attached) {
        await adapter.saveDocument(upload.document, upload.chunks);
      }
    });

    return session;
  },

  endSession: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, endTimeMs: Date.now() } : sess,
      ),
    }));
    const updated = get().sessions.find((s) => s.id === sessionId);
    if (updated) persist("endSession", () => getPersistenceAdapter().saveSession(updated));
  },

  setSummary: (sessionId, summary) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, summary } : sess)),
    }));
    const updated = get().sessions.find((s) => s.id === sessionId);
    if (updated) persist("setSummary", () => getPersistenceAdapter().saveSession(updated));
  },

  appendTranscript: (segment) => {
    set((s) => ({
      transcripts: {
        ...s.transcripts,
        [segment.sessionId]: [...(s.transcripts[segment.sessionId] ?? []), segment],
      },
    }));

    // Privacy Settings → "Save transcript" is a real switch, not decoration:
    // when it is off the segment stays in memory for the live session only.
    if (useSettingsStore.getState().privacy.saveTranscript) {
      persist("appendTranscript", () => getPersistenceAdapter().saveTranscriptSegment(segment));
    }
  },

  appendAiResponse: (record) => {
    set((s) => ({
      aiResponses: {
        ...s.aiResponses,
        [record.sessionId]: [...(s.aiResponses[record.sessionId] ?? []), record],
      },
    }));
    persist("appendAiResponse", () => getPersistenceAdapter().saveAiResponse(record));
  },

  addPendingUpload: (upload) => set((s) => ({ pendingUploads: [...s.pendingUploads, upload] })),

  addDocumentToSession: (sessionId, upload) => {
    const document = { ...upload.document, sessionId };
    const chunks = upload.chunks.map((chunk) => ({ ...chunk, sessionId }));
    set((s) => ({
      documentChunks: {
        ...s.documentChunks,
        [sessionId]: [...(s.documentChunks[sessionId] ?? []), ...chunks],
      },
    }));
    persist("addDocument", () => getPersistenceAdapter().saveDocument(document, chunks));
  },

  setAnalysis: (analysis) => {
    set((s) => ({ analyses: { ...s.analyses, [analysis.sessionId]: analysis } }));
    persist("setAnalysis", () => getPersistenceAdapter().saveAnalysis(analysis, Date.now()));
  },

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  deleteSession: (sessionId) => {
    set((s) => {
      const transcripts = { ...s.transcripts };
      const aiResponses = { ...s.aiResponses };
      const documentChunks = { ...s.documentChunks };
      const analyses = { ...s.analyses };
      delete transcripts[sessionId];
      delete aiResponses[sessionId];
      delete documentChunks[sessionId];
      delete analyses[sessionId];
      return {
        sessions: s.sessions.filter((sess) => sess.id !== sessionId),
        transcripts,
        aiResponses,
        documentChunks,
        analyses,
        activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
      };
    });
    persist("deleteSession", () => getPersistenceAdapter().deleteSession(sessionId));
  },
}));

export function nextRecordId(prefix: string): string {
  return nextId(prefix);
}

export function getActiveSession(): Session | null {
  const state = useSessionStore.getState();
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}
