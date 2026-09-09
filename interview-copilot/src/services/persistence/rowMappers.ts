import { z } from "zod";
import type {
  AIResponseRecord,
  CategoryScore,
  DocumentChunk,
  Session,
  SessionAnalysis,
  TranscriptSegment,
} from "@/types";

/**
 * Pure row → domain mapping for the SQLite adapter. Extracted from the
 * adapter so it can be unit-tested without a database, and Zod-validated
 * because rows crossing the Tauri IPC boundary are untrusted input
 * (docs/security.md — IPC boundary validation).
 */

/** SQLite has no boolean/array types; list columns are stored as JSON text. */
function jsonArray(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function encodeJsonArray(values: string[]): string {
  return JSON.stringify(values);
}

const sessionRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  role: z.string(),
  company: z.string(),
  start_time_ms: z.number(),
  end_time_ms: z.number().nullable(),
  mode: z.enum(["AUTO", "MANUAL"]),
  model_profile_override: z.string().nullable(),
  response_language: z.enum(["en", "ru"]),
  response_mode: z.enum(["SHORT", "NORMAL", "DETAILED"]),
  framework: z.enum([
    "STAR",
    "PREP",
    "CAR",
    "TECHNICAL",
    "SYSTEM_DESIGN",
    "BEHAVIORAL",
    "SALES",
    "PRODUCT_MANAGEMENT",
    "NONE",
  ]),
  user_instructions: z.string(),
  summary: z.string().nullable(),
});

export function rowToSession(row: unknown): Session {
  const parsed = sessionRowSchema.parse(row);
  return {
    id: parsed.id,
    title: parsed.title,
    role: parsed.role,
    company: parsed.company,
    startTimeMs: parsed.start_time_ms,
    endTimeMs: parsed.end_time_ms,
    mode: parsed.mode,
    modelProfileOverride: parsed.model_profile_override,
    responseLanguage: parsed.response_language,
    responseMode: parsed.response_mode,
    framework: parsed.framework,
    userInstructions: parsed.user_instructions,
    summary: parsed.summary,
  };
}

export function sessionToParams(session: Session): unknown[] {
  return [
    session.id,
    session.title,
    session.role,
    session.company,
    session.startTimeMs,
    session.endTimeMs,
    session.mode,
    session.modelProfileOverride,
    session.responseLanguage,
    session.responseMode,
    session.framework,
    session.userInstructions,
    session.summary,
  ];
}

const transcriptRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  speaker: z.enum(["CANDIDATE", "INTERVIEWER", "UNKNOWN"]),
  text: z.string(),
  timestamp_ms: z.number(),
  confidence: z.number(),
});

export function rowToTranscriptSegment(row: unknown): TranscriptSegment {
  const parsed = transcriptRowSchema.parse(row);
  return {
    id: parsed.id,
    sessionId: parsed.session_id,
    speaker: parsed.speaker,
    text: parsed.text,
    timestampMs: parsed.timestamp_ms,
    confidence: parsed.confidence,
  };
}

export function transcriptSegmentToParams(segment: TranscriptSegment): unknown[] {
  return [
    segment.id,
    segment.sessionId,
    segment.speaker,
    segment.text,
    segment.timestampMs,
    segment.confidence,
  ];
}

const aiResponseRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  task_type: z.string(),
  prompt: z.string(),
  answer: z.string(),
  key_points: z.string(),
  created_at_ms: z.number(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  // Nullable: rows written in demo mode (or by a provider with no pricing on
  // file) carry no cost at all rather than a fabricated one.
  estimated_cost_usd: z.number().nullable(),
});

export function rowToAiResponse(row: unknown): AIResponseRecord {
  const parsed = aiResponseRowSchema.parse(row);
  return {
    id: parsed.id,
    sessionId: parsed.session_id,
    taskType: parsed.task_type,
    prompt: parsed.prompt,
    answer: parsed.answer,
    keyPoints: jsonArray(parsed.key_points),
    createdAtMs: parsed.created_at_ms,
    inputTokens: parsed.input_tokens,
    outputTokens: parsed.output_tokens,
    estimatedCostUsd: parsed.estimated_cost_usd,
  };
}

export function aiResponseToParams(record: AIResponseRecord): unknown[] {
  return [
    record.id,
    record.sessionId,
    record.taskType,
    record.prompt,
    record.answer,
    encodeJsonArray(record.keyPoints),
    record.createdAtMs,
    record.inputTokens,
    record.outputTokens,
    record.estimatedCostUsd,
  ];
}

const docTypeSchema = z.enum(["RESUME", "JOB_DESCRIPTION", "PORTFOLIO", "NOTES", "OTHER"]);

const documentChunkRowSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  session_id: z.string(),
  doc_type: docTypeSchema,
  text: z.string(),
  order: z.number(),
});

export function rowToDocumentChunk(row: unknown): DocumentChunk {
  const parsed = documentChunkRowSchema.parse(row);
  return {
    id: parsed.id,
    documentId: parsed.document_id,
    sessionId: parsed.session_id,
    docType: parsed.doc_type,
    text: parsed.text,
    order: parsed.order,
  };
}

export function documentChunkToParams(chunk: DocumentChunk): unknown[] {
  return [chunk.id, chunk.documentId, chunk.sessionId, chunk.docType, chunk.text, chunk.order];
}

const categoryScoreSchema = z.object({
  category: z.enum([
    "TECHNICAL",
    "COMMUNICATION",
    "STRUCTURE",
    "RELEVANCE",
    "CONFIDENCE",
    "EXPERIENCE",
    "PROBLEM_SOLVING",
  ]),
  score: z.number(),
  evidence: z.string(),
});

const analysisRowSchema = z.object({
  session_id: z.string(),
  overall_score: z.number(),
  category_scores: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
  missed_opportunities: z.string(),
  red_flags: z.string(),
  best_answers: z.string(),
  weakest_answers: z.string(),
  recommendations: z.string(),
});

function parseCategoryScores(raw: string): CategoryScore[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => categoryScoreSchema.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => result.data);
  } catch {
    return [];
  }
}

export function rowToAnalysis(row: unknown): SessionAnalysis {
  const parsed = analysisRowSchema.parse(row);
  return {
    sessionId: parsed.session_id,
    overallScore: parsed.overall_score,
    categoryScores: parseCategoryScores(parsed.category_scores),
    strengths: jsonArray(parsed.strengths),
    weaknesses: jsonArray(parsed.weaknesses),
    missedOpportunities: jsonArray(parsed.missed_opportunities),
    redFlags: jsonArray(parsed.red_flags),
    bestAnswers: jsonArray(parsed.best_answers),
    weakestAnswers: jsonArray(parsed.weakest_answers),
    recommendations: jsonArray(parsed.recommendations),
  };
}

export function analysisToParams(analysis: SessionAnalysis, analyzedAtMs: number): unknown[] {
  return [
    analysis.sessionId,
    analysis.overallScore,
    JSON.stringify(analysis.categoryScores),
    encodeJsonArray(analysis.strengths),
    encodeJsonArray(analysis.weaknesses),
    encodeJsonArray(analysis.missedOpportunities),
    encodeJsonArray(analysis.redFlags),
    encodeJsonArray(analysis.bestAnswers),
    encodeJsonArray(analysis.weakestAnswers),
    encodeJsonArray(analysis.recommendations),
    analyzedAtMs,
  ];
}

/** Groups flat rows by their session id, preserving order. */
export function groupBySessionId<T extends { sessionId: string }>(items: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    (result[item.sessionId] ??= []).push(item);
  }
  return result;
}
