import type {
  AIResponseRecord,
  DocumentChunk,
  Session,
  SessionAnalysis,
  TranscriptSegment,
  UploadedDocument,
} from "@/types";

/** Everything restored into the session store at app start. */
export interface PersistedState {
  sessions: Session[];
  transcripts: Record<string, TranscriptSegment[]>;
  aiResponses: Record<string, AIResponseRecord[]>;
  documentChunks: Record<string, DocumentChunk[]>;
  analyses: Record<string, SessionAnalysis>;
}

export const EMPTY_PERSISTED_STATE: PersistedState = {
  sessions: [],
  transcripts: {},
  aiResponses: {},
  documentChunks: {},
  analyses: {},
};

/**
 * Domain-level persistence contract. Deliberately expressed in domain terms
 * rather than SQL so the browser dev server (no Tauri, no SQLite) can back it
 * with localStorage while the desktop build uses the real database — see
 * docs/architecture.md §1 for why the frontend never opens the .db directly.
 */
export interface PersistenceAdapter {
  readonly id: string;
  loadAll(): Promise<PersistedState>;
  saveSession(session: Session): Promise<void>;
  saveTranscriptSegment(segment: TranscriptSegment): Promise<void>;
  saveAiResponse(record: AIResponseRecord): Promise<void>;
  saveDocument(document: UploadedDocument, chunks: DocumentChunk[]): Promise<void>;
  saveAnalysis(analysis: SessionAnalysis, analyzedAtMs: number): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}
