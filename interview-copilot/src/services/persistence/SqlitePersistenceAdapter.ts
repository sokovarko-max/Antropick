import type { PersistedState, PersistenceAdapter } from "./types";
import {
  aiResponseToParams,
  analysisToParams,
  documentChunkToParams,
  groupBySessionId,
  rowToAiResponse,
  rowToAnalysis,
  rowToDocumentChunk,
  rowToSession,
  rowToTranscriptSegment,
  sessionToParams,
  transcriptSegmentToParams,
} from "./rowMappers";
import type {
  AIResponseRecord,
  DocumentChunk,
  Session,
  SessionAnalysis,
  TranscriptSegment,
  UploadedDocument,
} from "@/types";

export interface DbBridge {
  execute(sql: string, params: unknown[]): Promise<number>;
  query(sql: string, params: unknown[]): Promise<unknown[]>;
}

/** Default bridge: the db_execute / db_query Tauri commands. */
export const tauriDbBridge: DbBridge = {
  async execute(sql, params) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<number>("db_execute", { request: { sql, params } });
  },
  async query(sql, params) {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<{ rows: unknown[] }>("db_query", { request: { sql, params } });
    return response.rows;
  },
};

/**
 * Real persistence for the desktop build. Every statement is parameterized —
 * no SQL is ever built by concatenating user input (docs/security.md).
 */
export class SqlitePersistenceAdapter implements PersistenceAdapter {
  readonly id = "sqlite";

  constructor(private readonly db: DbBridge = tauriDbBridge) {}

  async loadAll(): Promise<PersistedState> {
    const [sessionRows, transcriptRows, aiRows, chunkRows, analysisRows] = await Promise.all([
      this.db.query("SELECT * FROM sessions ORDER BY start_time_ms DESC", []),
      this.db.query("SELECT * FROM transcript_segments ORDER BY timestamp_ms ASC", []),
      this.db.query("SELECT * FROM ai_responses ORDER BY created_at_ms ASC", []),
      this.db.query('SELECT * FROM document_chunks ORDER BY "order" ASC', []),
      this.db.query("SELECT * FROM session_analysis", []),
    ]);

    const analyses: Record<string, SessionAnalysis> = {};
    for (const row of analysisRows) {
      const analysis = rowToAnalysis(row);
      analyses[analysis.sessionId] = analysis;
    }

    return {
      sessions: sessionRows.map(rowToSession),
      transcripts: groupBySessionId(transcriptRows.map(rowToTranscriptSegment)),
      aiResponses: groupBySessionId(aiRows.map(rowToAiResponse)),
      documentChunks: groupBySessionId(chunkRows.map(rowToDocumentChunk)),
      analyses,
    };
  }

  async saveSession(session: Session): Promise<void> {
    await this.db.execute(
      `INSERT INTO sessions
         (id, title, role, company, start_time_ms, end_time_ms, mode, model_profile_override,
          response_language, response_mode, framework, user_instructions, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         role = excluded.role,
         company = excluded.company,
         end_time_ms = excluded.end_time_ms,
         mode = excluded.mode,
         model_profile_override = excluded.model_profile_override,
         response_language = excluded.response_language,
         response_mode = excluded.response_mode,
         framework = excluded.framework,
         user_instructions = excluded.user_instructions,
         summary = excluded.summary`,
      sessionToParams(session),
    );
  }

  async saveTranscriptSegment(segment: TranscriptSegment): Promise<void> {
    await this.db.execute(
      `INSERT INTO transcript_segments (id, session_id, speaker, text, timestamp_ms, confidence)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      transcriptSegmentToParams(segment),
    );
  }

  async saveAiResponse(record: AIResponseRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO ai_responses
         (id, session_id, task_type, prompt, answer, key_points, created_at_ms,
          input_tokens, output_tokens, estimated_cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      aiResponseToParams(record),
    );
  }

  async saveDocument(document: UploadedDocument, chunks: DocumentChunk[]): Promise<void> {
    // The documents row must exist before its chunks — document_chunks has a
    // foreign key onto it and the connection runs with foreign_keys = ON.
    await this.db.execute(
      `INSERT INTO documents
         (id, session_id, doc_type, original_file_name, storage_file_name, uploaded_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [
        document.id,
        document.sessionId,
        document.docType,
        document.originalFileName,
        document.storageFileName,
        document.uploadedAtMs,
      ],
    );

    for (const chunk of chunks) {
      await this.db.execute(
        `INSERT INTO document_chunks (id, document_id, session_id, doc_type, text, "order")
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        documentChunkToParams(chunk),
      );
    }
  }

  async saveAnalysis(analysis: SessionAnalysis, analyzedAtMs: number): Promise<void> {
    await this.db.execute(
      `INSERT INTO session_analysis
         (session_id, overall_score, category_scores, strengths, weaknesses,
          missed_opportunities, red_flags, best_answers, weakest_answers,
          recommendations, analyzed_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         overall_score = excluded.overall_score,
         category_scores = excluded.category_scores,
         strengths = excluded.strengths,
         weaknesses = excluded.weaknesses,
         missed_opportunities = excluded.missed_opportunities,
         red_flags = excluded.red_flags,
         best_answers = excluded.best_answers,
         weakest_answers = excluded.weakest_answers,
         recommendations = excluded.recommendations,
         analyzed_at_ms = excluded.analyzed_at_ms`,
      analysisToParams(analysis, analyzedAtMs),
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Children first — foreign keys are enforced.
    for (const sql of [
      "DELETE FROM document_chunks WHERE session_id = ?",
      "DELETE FROM documents WHERE session_id = ?",
      "DELETE FROM ai_responses WHERE session_id = ?",
      "DELETE FROM transcript_segments WHERE session_id = ?",
      "DELETE FROM screenshots WHERE session_id = ?",
      "DELETE FROM session_analysis WHERE session_id = ?",
      "DELETE FROM sessions WHERE id = ?",
    ]) {
      await this.db.execute(sql, [sessionId]);
    }
  }
}
