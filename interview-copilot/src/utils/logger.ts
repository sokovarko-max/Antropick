export type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const SECRET_KEY_PATTERN = /^(api[-_]?key|authorization|token|password|secret)$/i;

/**
 * Fields whose *values* are user content rather than secrets. They are
 * dropped unless the two-flag content-debug gate is open — see
 * docs/security.md (never log transcript/audio/screenshot content).
 */
const CONTENT_KEY_PATTERN = /^(transcript|text|answer|prompt|segment|screenshot|audio|pcm)$/i;

function contentLoggingEnabled(): boolean {
  // Two independent flags, both required, so content logging can never be
  // switched on by accident in a shipped build.
  return import.meta.env?.DEV_MODE === "true" && import.meta.env?.DEBUG_LOG_CONTENT === "true";
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      result[key] = REDACTED;
    } else if (CONTENT_KEY_PATTERN.test(key) && !contentLoggingEnabled()) {
      result[key] = "[CONTENT-OMITTED]";
    } else {
      result[key] = redact(entry, depth + 1);
    }
  }
  return result;
}

function emit(level: LogLevel, scope: string, message: string, context?: unknown): void {
  const payload = context === undefined ? undefined : redact(context);
  const line = `[${scope}] ${message}`;
  if (level === "error") console.error(line, payload ?? "");
  else if (level === "warn") console.warn(line, payload ?? "");
  else if (level === "info") console.info(line, payload ?? "");
  else if (import.meta.env?.DEV) console.debug(line, payload ?? "");
}

/** Structured, redacting logger. Never pass a raw API key or transcript here. */
export function createLogger(scope: string) {
  return {
    debug: (message: string, context?: unknown) => emit("debug", scope, message, context),
    info: (message: string, context?: unknown) => emit("info", scope, message, context),
    warn: (message: string, context?: unknown) => emit("warn", scope, message, context),
    error: (message: string, context?: unknown) => emit("error", scope, message, context),
  };
}
