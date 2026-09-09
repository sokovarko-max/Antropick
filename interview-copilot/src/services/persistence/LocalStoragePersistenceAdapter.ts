import { EMPTY_PERSISTED_STATE, type PersistedState, type PersistenceAdapter } from "./types";
import type {
  AIResponseRecord,
  DocumentChunk,
  Session,
  SessionAnalysis,
  TranscriptSegment,
  UploadedDocument,
} from "@/types";

const STORAGE_KEY = "interview-copilot-data";

/**
 * Dev-server fallback: outside a Tauri window there is no SQLite to talk to,
 * so session history is kept in localStorage instead. This keeps the whole UI
 * (history, analysis, documents) exercisable with `pnpm dev` — it is not the
 * shipping storage path, which is always SqlitePersistenceAdapter.
 */
export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  readonly id = "localstorage";

  async loadAll(): Promise<PersistedState> {
    return this.read();
  }

  async saveSession(session: Session): Promise<void> {
    this.mutate((state) => {
      const index = state.sessions.findIndex((s) => s.id === session.id);
      if (index === -1) state.sessions.unshift(session);
      else state.sessions[index] = session;
    });
  }

  async saveTranscriptSegment(segment: TranscriptSegment): Promise<void> {
    this.mutate((state) => {
      const list = (state.transcripts[segment.sessionId] ??= []);
      if (!list.some((s) => s.id === segment.id)) list.push(segment);
    });
  }

  async saveAiResponse(record: AIResponseRecord): Promise<void> {
    this.mutate((state) => {
      const list = (state.aiResponses[record.sessionId] ??= []);
      if (!list.some((r) => r.id === record.id)) list.push(record);
    });
  }

  async saveDocument(_document: UploadedDocument, chunks: DocumentChunk[]): Promise<void> {
    this.mutate((state) => {
      for (const chunk of chunks) {
        const list = (state.documentChunks[chunk.sessionId] ??= []);
        if (!list.some((c) => c.id === chunk.id)) list.push(chunk);
      }
    });
  }

  async saveAnalysis(analysis: SessionAnalysis): Promise<void> {
    this.mutate((state) => {
      state.analyses[analysis.sessionId] = analysis;
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.mutate((state) => {
      state.sessions = state.sessions.filter((s) => s.id !== sessionId);
      delete state.transcripts[sessionId];
      delete state.aiResponses[sessionId];
      delete state.documentChunks[sessionId];
      delete state.analyses[sessionId];
    });
  }

  private read(): PersistedState {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(EMPTY_PERSISTED_STATE);
      return { ...structuredClone(EMPTY_PERSISTED_STATE), ...JSON.parse(raw) };
    } catch {
      return structuredClone(EMPTY_PERSISTED_STATE);
    }
  }

  private mutate(fn: (state: PersistedState) => void): void {
    const state = this.read();
    fn(state);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — persistence is best-effort in dev.
    }
  }
}
