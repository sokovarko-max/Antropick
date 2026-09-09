import { describe, expect, it } from "vitest";
import { ContextEngine } from "@/services/context/ContextEngine";
import { TranscriptEngine } from "@/services/session/TranscriptEngine";
import type { DocumentChunk } from "@/types";

function chunk(text: string, docType: DocumentChunk["docType"], order = 0): DocumentChunk {
  return { id: `c_${order}_${docType}`, documentId: "doc1", sessionId: "sess1", docType, text, order };
}

describe("ContextEngine", () => {
  it("only includes transcript within the configured recent window", () => {
    const engine = new ContextEngine({ recentWindowMs: 5000, maxChunksPerDocType: 3 });
    const transcript = new TranscriptEngine("sess1");
    transcript.append({ speaker: "INTERVIEWER", text: "old", timestampMs: 0, confidence: 1 });
    const trigger = transcript.append({
      speaker: "INTERVIEWER",
      text: "Tell me about Kubernetes",
      timestampMs: 10000,
      confidence: 1,
    });

    const result = engine.assemble({
      triggerSegment: trigger,
      transcript,
      sessionSummary: null,
      resumeChunks: [],
      jobDescriptionChunks: [],
      userInstructions: "",
      responseMode: "SHORT",
      framework: "NONE",
    });

    expect(result.recentTranscript).toHaveLength(1);
    expect(result.recentTranscript[0]?.text).toBe("Tell me about Kubernetes");
  });

  it("selects only the most relevant resume/JD chunks, capped per doc type", () => {
    const engine = new ContextEngine({ recentWindowMs: 60000, maxChunksPerDocType: 1 });
    const transcript = new TranscriptEngine("sess1");
    const trigger = transcript.append({
      speaker: "INTERVIEWER",
      text: "Tell me about your Kubernetes experience",
      timestampMs: 0,
      confidence: 1,
    });

    const resumeChunks = [
      chunk("Worked extensively with Kubernetes clusters in production", "RESUME", 0),
      chunk("Enjoys hiking and photography on weekends", "RESUME", 1),
    ];

    const result = engine.assemble({
      triggerSegment: trigger,
      transcript,
      sessionSummary: null,
      resumeChunks,
      jobDescriptionChunks: [],
      userInstructions: "",
      responseMode: "SHORT",
      framework: "NONE",
    });

    expect(result.resumeChunks).toHaveLength(1);
    expect(result.resumeChunks[0]?.text).toContain("Kubernetes");
  });

  it("passes through session summary, instructions, mode and framework unchanged", () => {
    const engine = new ContextEngine();
    const transcript = new TranscriptEngine("sess1");
    const trigger = transcript.append({ speaker: "INTERVIEWER", text: "q", timestampMs: 0, confidence: 1 });

    const result = engine.assemble({
      triggerSegment: trigger,
      transcript,
      sessionSummary: "candidate discussed backend systems",
      resumeChunks: [],
      jobDescriptionChunks: [],
      userInstructions: "be concise",
      responseMode: "DETAILED",
      framework: "STAR",
    });

    expect(result.sessionSummary).toBe("candidate discussed backend systems");
    expect(result.userInstructions).toBe("be concise");
    expect(result.responseMode).toBe("DETAILED");
    expect(result.framework).toBe("STAR");
  });
});
