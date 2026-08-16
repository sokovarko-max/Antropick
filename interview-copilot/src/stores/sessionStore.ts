import { create } from "zustand";
import type {
  AIResponseRecord,
  DocumentChunk,
  InterviewFramework,
  ResponseMode,
  Session,
  SessionAnalysis,
  SessionMode,
  TranscriptSegment,
} from "@/types";

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

interface SessionState {
  sessions: Session[];
  transcripts: Record<string, TranscriptSegment[]>;
  aiResponses: Record<string, AIResponseRecord[]>;
  documentChunks: Record<string, DocumentChunk[]>;
  analyses: Record<string, SessionAnalysis>;
  activeSessionId: string | null;

  createSession: (input: NewSessionInput) => Session;
  endSession: (sessionId: string) => void;
  setSummary: (sessionId: string, summary: string) => void;
  appendTranscript: (segment: TranscriptSegment) => void;
  appendAiResponse: (record: AIResponseRecord) => void;
  addDocumentChunks: (chunks: DocumentChunk[]) => void;
  setAnalysis: (analysis: SessionAnalysis) => void;
  setActiveSession: (sessionId: string | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessions: [],
  transcripts: {},
  aiResponses: {},
  documentChunks: {},
  analyses: {},
  activeSessionId: null,

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
    set((s) => ({
      sessions: [session, ...s.sessions],
      transcripts: { ...s.transcripts, [session.id]: [] },
      aiResponses: { ...s.aiResponses, [session.id]: [] },
      activeSessionId: session.id,
    }));
    return session;
  },

  endSession: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, endTimeMs: Date.now() } : sess,
      ),
    })),

  setSummary: (sessionId, summary) =>
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, summary } : sess)),
    })),

  appendTranscript: (segment) =>
    set((s) => ({
      transcripts: {
        ...s.transcripts,
        [segment.sessionId]: [...(s.transcripts[segment.sessionId] ?? []), segment],
      },
    })),

  appendAiResponse: (record) =>
    set((s) => ({
      aiResponses: {
        ...s.aiResponses,
        [record.sessionId]: [...(s.aiResponses[record.sessionId] ?? []), record],
      },
    })),

  addDocumentChunks: (chunks) =>
    set((s) => {
      const bySession = { ...s.documentChunks };
      for (const chunk of chunks) {
        bySession[chunk.sessionId] = [...(bySession[chunk.sessionId] ?? []), chunk];
      }
      return { documentChunks: bySession };
    }),

  setAnalysis: (analysis) =>
    set((s) => ({ analyses: { ...s.analyses, [analysis.sessionId]: analysis } })),

  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
}));

export function nextRecordId(prefix: string): string {
  return nextId(prefix);
}

export function getActiveSession(): Session | null {
  const state = useSessionStore.getState();
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}
