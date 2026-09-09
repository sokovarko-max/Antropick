import { describe, expect, it, vi } from "vitest";
import {
  SqlitePersistenceAdapter,
  type DbBridge,
} from "@/services/persistence/SqlitePersistenceAdapter";
import type { DocumentChunk, Session, UploadedDocument } from "@/types";

function fakeBridge(rowsBySql: Record<string, unknown[]> = {}) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  const bridge: DbBridge = {
    execute: vi.fn(async (sql: string, params: unknown[]) => {
      executed.push({ sql, params });
      return 1;
    }),
    query: vi.fn(async (sql: string) => {
      const key = Object.keys(rowsBySql).find((k) => sql.includes(k));
      return key ? rowsBySql[key]! : [];
    }),
  };
  return { bridge, executed };
}

const session: Session = {
  id: "sess1",
  title: "t",
  role: "r",
  company: "c",
  startTimeMs: 1,
  endTimeMs: null,
  mode: "AUTO",
  modelProfileOverride: null,
  responseLanguage: "en",
  responseMode: "SHORT",
  framework: "NONE",
  userInstructions: "",
  summary: null,
};

describe("SqlitePersistenceAdapter", () => {
  it("loads and groups every table into the store shape", async () => {
    const { bridge } = fakeBridge({
      "FROM sessions": [
        {
          id: "sess1",
          title: "t",
          role: "r",
          company: "c",
          start_time_ms: 1,
          end_time_ms: null,
          mode: "AUTO",
          model_profile_override: null,
          response_language: "en",
          response_mode: "SHORT",
          framework: "NONE",
          user_instructions: "",
          summary: null,
        },
      ],
      "FROM transcript_segments": [
        {
          id: "seg1",
          session_id: "sess1",
          speaker: "CANDIDATE",
          text: "hi",
          timestamp_ms: 5,
          confidence: 1,
        },
      ],
      "FROM session_analysis": [
        {
          session_id: "sess1",
          overall_score: 70,
          category_scores: "[]",
          strengths: "[]",
          weaknesses: "[]",
          missed_opportunities: "[]",
          red_flags: "[]",
          best_answers: "[]",
          weakest_answers: "[]",
          recommendations: "[]",
        },
      ],
    });

    const state = await new SqlitePersistenceAdapter(bridge).loadAll();
    expect(state.sessions).toHaveLength(1);
    expect(state.transcripts["sess1"]).toHaveLength(1);
    expect(state.analyses["sess1"]?.overallScore).toBe(70);
  });

  it("passes user data only as bound parameters, never inside the SQL text", async () => {
    const { bridge, executed } = fakeBridge();
    const hostile = { ...session, company: "'); DROP TABLE sessions;--" };

    await new SqlitePersistenceAdapter(bridge).saveSession(hostile);

    const call = executed[0]!;
    expect(call.sql).not.toContain("DROP TABLE");
    expect(call.params).toContain("'); DROP TABLE sessions;--");
  });

  it("writes the documents row before its chunks so the foreign key holds", async () => {
    const { bridge, executed } = fakeBridge();
    const document: UploadedDocument = {
      id: "doc1",
      sessionId: "sess1",
      docType: "RESUME",
      originalFileName: "cv.pdf",
      storageFileName: "uuid.txt",
      uploadedAtMs: 1,
    };
    const chunks: DocumentChunk[] = [
      { id: "c1", documentId: "doc1", sessionId: "sess1", docType: "RESUME", text: "a", order: 0 },
      { id: "c2", documentId: "doc1", sessionId: "sess1", docType: "RESUME", text: "b", order: 1 },
    ];

    await new SqlitePersistenceAdapter(bridge).saveDocument(document, chunks);

    expect(executed).toHaveLength(3);
    expect(executed[0]!.sql).toContain("INTO documents");
    expect(executed[1]!.sql).toContain("INTO document_chunks");
    expect(executed[2]!.sql).toContain("INTO document_chunks");
  });

  it("deletes child rows before the session row", async () => {
    const { bridge, executed } = fakeBridge();
    await new SqlitePersistenceAdapter(bridge).deleteSession("sess1");

    const lastStatement = executed[executed.length - 1]!.sql;
    expect(lastStatement).toContain("FROM sessions WHERE id");
    expect(executed.every((call) => call.params[0] === "sess1")).toBe(true);
  });

  it("upserts a session rather than failing on a repeat save", async () => {
    const { bridge, executed } = fakeBridge();
    await new SqlitePersistenceAdapter(bridge).saveSession(session);
    expect(executed[0]!.sql).toContain("ON CONFLICT(id) DO UPDATE");
  });
});
