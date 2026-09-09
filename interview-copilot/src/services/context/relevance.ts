import type { DocumentChunk } from "@/types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Lexical (term-overlap) relevance scoring — the MVP's stand-in for
 * embeddings-based retrieval. See docs/architecture.md §8 for the deferral
 * rationale; ContextStore.query() below is the single seam a real vector
 * index would replace.
 */
export function scoreChunkRelevance(query: string, chunk: DocumentChunk): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const chunkTokens = tokenize(chunk.text);
  if (chunkTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of chunkTokens) {
    if (queryTokens.has(token)) overlap += 1;
  }
  return overlap / chunkTokens.length;
}

export function topRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  limit: number,
): DocumentChunk[] {
  return [...chunks]
    .map((chunk) => ({ chunk, score: scoreChunkRelevance(query, chunk) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.chunk);
}
