import { describe, expect, it } from "vitest";
import { TranscriptEngine } from "@/services/session/TranscriptEngine";

describe("TranscriptEngine", () => {
  it("appends segments and assigns unique ids and the session id", () => {
    const engine = new TranscriptEngine("sess1");
    const a = engine.append({ speaker: "CANDIDATE", text: "hi", timestampMs: 0, confidence: 1 });
    const b = engine.append({ speaker: "INTERVIEWER", text: "hello", timestampMs: 1, confidence: 1 });
    expect(a.id).not.toBe(b.id);
    expect(a.sessionId).toBe("sess1");
    expect(engine.all()).toHaveLength(2);
  });

  it("recentWindow returns only segments within windowMs of the latest segment", () => {
    const engine = new TranscriptEngine("sess1");
    engine.append({ speaker: "CANDIDATE", text: "a", timestampMs: 0, confidence: 1 });
    engine.append({ speaker: "CANDIDATE", text: "b", timestampMs: 5000, confidence: 1 });
    engine.append({ speaker: "CANDIDATE", text: "c", timestampMs: 9000, confidence: 1 });

    const recent = engine.recentWindow(4000);
    expect(recent.map((s) => s.text)).toEqual(["b", "c"]);
  });

  it("since returns segments strictly after the given timestamp", () => {
    const engine = new TranscriptEngine("sess1");
    engine.append({ speaker: "CANDIDATE", text: "a", timestampMs: 100, confidence: 1 });
    engine.append({ speaker: "CANDIDATE", text: "b", timestampMs: 200, confidence: 1 });
    expect(engine.since(100).map((s) => s.text)).toEqual(["b"]);
  });

  it("clear empties the transcript", () => {
    const engine = new TranscriptEngine("sess1");
    engine.append({ speaker: "CANDIDATE", text: "a", timestampMs: 0, confidence: 1 });
    engine.clear();
    expect(engine.all()).toHaveLength(0);
  });
});
