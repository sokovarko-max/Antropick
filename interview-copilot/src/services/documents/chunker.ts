export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
}

const DEFAULT_OPTIONS: ChunkOptions = { chunkSize: 800, overlap: 100 };

/** Fixed-size overlapping character chunks — see docs/data-flow.md §3. */
export function chunkText(text: string, options: ChunkOptions = DEFAULT_OPTIONS): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  const chunks: string[] = [];
  const step = Math.max(1, options.chunkSize - options.overlap);
  for (let start = 0; start < normalized.length; start += step) {
    const chunk = normalized.slice(start, start + options.chunkSize).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (start + options.chunkSize >= normalized.length) break;
  }
  return chunks;
}
