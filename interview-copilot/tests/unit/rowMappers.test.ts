import { describe, expect, it } from "vitest";
import {
  aiResponseToParams,
  analysisToParams,
  groupBySessionId,
  rowToAiResponse,
  rowToAnalysis,
  rowToDocumentChunk,
  rowToSession,
  rowToTranscriptSegment,
  sessionToParams,
  transcriptSegmentToParams,
} from "@/services/persistence/rowMappers";
import type { AIResponseRecord, Session, SessionAnalysis, TranscriptSegment } from "@/types";

const sessionRow = {
  id: "sess1",
  title: "Senior Backend Engineer — Acme",
  role: "Senior Backend Engineer",
  company: "Acme",
  start_time_ms: 1_700_000_000_000,
  end_time_ms: null,
  mode: "AUTO",
  model_profile_override: null,
  response_language: "en",
  response_mode: "SHORT",
  framework: "STAR",
  user_instructions: "be concise",
  summary: null,
};

describe("rowToSession", () => {
  it("maps snake_case columns onto the domain shape", () => {
    const session = rowToSession(sessionRow);
    expect(session.startTimeMs).toBe(1_700_000_000_000);
    expect(session.endTimeMs).toBeNull();
    expect(session.userInstructions).toBe("be concise");
    expect(session.framework).toBe("STAR");
  });

  it("rejects a row with an invalid enum value", () => {
    expect(() => rowToSession({ ...sessionRow, mode: "TURBO" })).toThrow();
  });

  it("rejects a row missing a required column", () => {
    const { title: _title, ...incomplete } = sessionRow;
    expect(() => rowToSession(incomplete)).toThrow();
  });

  it("round-trips through sessionToParams in column order", () => {
    const session: Session = rowToSession(sessionRow);
    const params = sessionToParams(session);
    expect(params[0]).toBe("sess1");
    expect(params[4]).toBe(1_700_000_000_000);
    expect(params).toHaveLength(13);
  });
});

describe("rowToTranscriptSegment", () => {
  it("maps a transcript row and round-trips to params", () => {
    const segment: TranscriptSegment = rowToTranscriptSegment({
      id: "seg1",
      session_id: "sess1",
      speaker: "INTERVIEWER",
      text: "Why PostgreSQL?",
      timestamp_ms: 42,
      confidence: 0.91,
    });
    expect(segment.sessionId).toBe("sess1");
    expect(segment.speaker).toBe("INTERVIEWER");
    expect(transcriptSegmentToParams(segment)).toEqual([
      "seg1",
      "sess1",
      "INTERVIEWER",
      "Why PostgreSQL?",
      42,
      0.91,
    ]);
  });
});

describe("rowToAiResponse", () => {
  const baseRow = {
    id: "resp1",
    session_id: "sess1",
    task_type: "REALTIME",
    prompt: "p",
    answer: "a",
    key_points: JSON.stringify(["one", "two"]),
    created_at_ms: 10,
    input_tokens: 100,
    output_tokens: 50,
    estimated_cost_usd: 0.0012,
  };

  it("decodes the JSON key_points column", () => {
    expect(rowToAiResponse(baseRow).keyPoints).toEqual(["one", "two"]);
  });

  it("falls back to an empty list when key_points is not valid JSON", () => {
    expect(rowToAiResponse({ ...baseRow, key_points: "not json" }).keyPoints).toEqual([]);
  });

  it("drops non-string entries rather than corrupting the domain type", () => {
    const row = { ...baseRow, key_points: JSON.stringify(["ok", 42, null]) };
    expect(rowToAiResponse(row).keyPoints).toEqual(["ok"]);
  });

  it("re-encodes key_points as JSON on the way back to SQL", () => {
    const record: AIResponseRecord = rowToAiResponse(baseRow);
    expect(aiResponseToParams(record)[5]).toBe('["one","two"]');
  });
});

describe("rowToDocumentChunk", () => {
  it("maps the quoted `order` column", () => {
    const chunk = rowToDocumentChunk({
      id: "c1",
      document_id: "d1",
      session_id: "sess1",
      doc_type: "RESUME",
      text: "chunk text",
      order: 3,
    });
    expect(chunk.order).toBe(3);
    expect(chunk.documentId).toBe("d1");
  });
});

describe("rowToAnalysis", () => {
  const analysisRow = {
    session_id: "sess1",
    overall_score: 82,
    category_scores: JSON.stringify([
      { category: "TECHNICAL", score: 85, evidence: "Explained CAP correctly." },
    ]),
    strengths: JSON.stringify(["clear"]),
    weaknesses: "[]",
    missed_opportunities: "[]",
    red_flags: "[]",
    best_answers: "[]",
    weakest_answers: "[]",
    recommendations: JSON.stringify(["practice system design"]),
  };

  it("decodes category scores and list columns", () => {
    const analysis: SessionAnalysis = rowToAnalysis(analysisRow);
    expect(analysis.overallScore).toBe(82);
    expect(analysis.categoryScores).toHaveLength(1);
    expect(analysis.categoryScores[0]?.evidence).toBe("Explained CAP correctly.");
    expect(analysis.recommendations).toEqual(["practice system design"]);
  });

  it("drops category entries that fail validation instead of throwing", () => {
    const row = {
      ...analysisRow,
      category_scores: JSON.stringify([
        { category: "NOT_A_CATEGORY", score: 10, evidence: "x" },
        { category: "COMMUNICATION", score: 70, evidence: "y" },
      ]),
    };
    const analysis = rowToAnalysis(row);
    expect(analysis.categoryScores).toHaveLength(1);
    expect(analysis.categoryScores[0]?.category).toBe("COMMUNICATION");
  });

  it("serializes back with the analyzed timestamp last", () => {
    const analysis = rowToAnalysis(analysisRow);
    const params = analysisToParams(analysis, 999);
    expect(params).toHaveLength(11);
    expect(params[10]).toBe(999);
  });
});

describe("groupBySessionId", () => {
  it("groups by session id preserving input order", () => {
    const grouped = groupBySessionId([
      { sessionId: "a", n: 1 },
      { sessionId: "b", n: 2 },
      { sessionId: "a", n: 3 },
    ]);
    expect(grouped["a"]?.map((x) => x.n)).toEqual([1, 3]);
    expect(grouped["b"]?.map((x) => x.n)).toEqual([2]);
  });

  it("returns an empty object for no rows", () => {
    expect(groupBySessionId([])).toEqual({});
  });
});
