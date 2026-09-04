import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Source-of-truth schema, authored with Drizzle for type-safe migrations
 * (`drizzle-kit generate`). The Rust backend executes the generated SQL via
 * rusqlite and is the only process that opens the .db file directly — see
 * docs/architecture.md §1 for why Drizzle isn't run inside the WebView.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  experienceYears: integer("experience_years"),
  skills: text("skills").notNull().default("[]"), // JSON array
  companies: text("companies").notNull().default("[]"),
  projects: text("projects").notNull().default("[]"),
  technologies: text("technologies").notNull().default("[]"),
  achievements: text("achievements").notNull().default("[]"),
  preferredAnswerStyle: text("preferred_answer_style").notNull().default(""),
  createdAtMs: integer("created_at_ms").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  role: text("role").notNull().default(""),
  company: text("company").notNull().default(""),
  startTimeMs: integer("start_time_ms").notNull(),
  endTimeMs: integer("end_time_ms"),
  mode: text("mode").notNull().default("AUTO"), // AUTO | MANUAL
  modelProfileOverride: text("model_profile_override"),
  responseLanguage: text("response_language").notNull().default("en"),
  responseMode: text("response_mode").notNull().default("SHORT"),
  framework: text("framework").notNull().default("NONE"),
  userInstructions: text("user_instructions").notNull().default(""),
  summary: text("summary"),
});

export const transcriptSegments = sqliteTable("transcript_segments", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  speaker: text("speaker").notNull(), // CANDIDATE | INTERVIEWER | UNKNOWN
  text: text("text").notNull(),
  timestampMs: integer("timestamp_ms").notNull(),
  confidence: real("confidence").notNull().default(1),
});

export const aiResponses = sqliteTable("ai_responses", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  taskType: text("task_type").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  keyPoints: text("key_points").notNull().default("[]"), // JSON array
  createdAtMs: integer("created_at_ms").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  // Nullable on purpose: null means "the answering model has no price on
  // file" (demo mode, or a vendor added without pricing). Storing 0 there
  // would claim the call was free, and storing a guess would claim a cost
  // that was never incurred.
  estimatedCostUsd: real("estimated_cost_usd"),
});

export const screenshots = sqliteTable("screenshots", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  // Null unless Privacy Settings > "save screenshots" is ON — see docs/security.md.
  storagePath: text("storage_path"),
  capturedAtMs: integer("captured_at_ms").notNull(),
  analysis: text("analysis").notNull().default(""),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  docType: text("doc_type").notNull(), // RESUME | JOB_DESCRIPTION | PORTFOLIO | NOTES | OTHER
  originalFileName: text("original_file_name").notNull(),
  // UUID-based storage filename — see docs/security.md (path traversal).
  storageFileName: text("storage_file_name").notNull(),
  uploadedAtMs: integer("uploaded_at_ms").notNull(),
});

export const documentChunks = sqliteTable("document_chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  docType: text("doc_type").notNull(),
  text: text("text").notNull(),
  order: integer("order").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON-encoded; never the API key (see security.md)
});

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(), // e.g. "anthropic"
  displayName: text("display_name").notNull(),
  connectionStatus: text("connection_status").notNull().default("UNKNOWN"),
  lastTestedAtMs: integer("last_tested_at_ms"),
});

export const models = sqliteTable("models", {
  taskType: text("task_type").primaryKey(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
});

export const hotkeys = sqliteTable("hotkeys", {
  action: text("action").primaryKey(), // ASK_AI | SCREENSHOT | HIDE | PAUSE
  combo: text("combo").notNull(),
});

export const sessionAnalysis = sqliteTable("session_analysis", {
  sessionId: text("session_id").primaryKey(),
  overallScore: integer("overall_score").notNull(),
  categoryScores: text("category_scores").notNull(), // JSON array of CategoryScore
  strengths: text("strengths").notNull().default("[]"),
  weaknesses: text("weaknesses").notNull().default("[]"),
  missedOpportunities: text("missed_opportunities").notNull().default("[]"),
  redFlags: text("red_flags").notNull().default("[]"),
  bestAnswers: text("best_answers").notNull().default("[]"),
  weakestAnswers: text("weakest_answers").notNull().default("[]"),
  recommendations: text("recommendations").notNull().default("[]"),
  analyzedAtMs: integer("analyzed_at_ms").notNull(),
});
