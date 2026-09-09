import { describe, expect, it } from "vitest";
import { redact } from "@/utils/logger";

describe("redact", () => {
  it("masks secret-bearing keys regardless of casing", () => {
    const result = redact({ apiKey: "sk-ant-secret", Authorization: "Bearer x", token: "t" }) as Record<
      string,
      unknown
    >;
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.Authorization).toBe("[REDACTED]");
    expect(result.token).toBe("[REDACTED]");
  });

  it("masks secrets nested inside objects and arrays", () => {
    const result = redact({ outer: { list: [{ api_key: "sk-ant-secret" }] } }) as {
      outer: { list: Array<Record<string, unknown>> };
    };
    expect(result.outer.list[0]!.api_key).toBe("[REDACTED]");
  });

  it("omits user content fields unless the content-debug gate is open", () => {
    const result = redact({ transcript: "candidate said something private" }) as Record<
      string,
      unknown
    >;
    expect(result.transcript).toBe("[CONTENT-OMITTED]");
  });

  it("leaves ordinary diagnostic fields intact", () => {
    const result = redact({ sessionId: "sess1", latencyMs: 1234 }) as Record<string, unknown>;
    expect(result.sessionId).toBe("sess1");
    expect(result.latencyMs).toBe(1234);
  });

  it("passes primitives through unchanged", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(7)).toBe(7);
    expect(redact(null)).toBeNull();
  });

  it("stops at a depth limit rather than recursing forever", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: "deep" } } } } } } } };
    expect(JSON.stringify(redact(deep))).toContain("depth-limit");
  });
});
