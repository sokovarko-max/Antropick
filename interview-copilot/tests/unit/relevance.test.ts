import { describe, expect, it } from "vitest";
import { scoreChunkRelevance, topRelevantChunks } from "@/services/context/relevance";
import type { DocumentChunk } from "@/types";

function chunk(text: string, order = 0): DocumentChunk {
  return { id: `c${order}`, documentId: "d1", sessionId: "s1", docType: "RESUME", text, order };
}

describe("relevance scoring", () => {
  it("scores zero for a chunk with no term overlap", () => {
    const score = scoreChunkRelevance("Kubernetes deployment", chunk("Enjoys painting landscapes"));
    expect(score).toBe(0);
  });

  it("scores higher for greater term overlap", () => {
    const low = scoreChunkRelevance("Kubernetes", chunk("Kubernetes is mentioned once here among filler words"));
    const high = scoreChunkRelevance("Kubernetes", chunk("Kubernetes Kubernetes Kubernetes"));
    expect(high).toBeGreaterThan(low);
  });

  it("topRelevantChunks excludes zero-score chunks and respects the limit", () => {
    const chunks = [
      chunk("Led Kubernetes migration for production workloads", 0),
      chunk("Enjoys hiking on weekends", 1),
      chunk("Kubernetes cluster autoscaling and monitoring", 2),
    ];
    const top = topRelevantChunks("Tell me about your Kubernetes experience", chunks, 1);
    expect(top).toHaveLength(1);
    expect(top[0]?.text).toMatch(/Kubernetes/);
  });
});
