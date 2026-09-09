import { describe, expect, it } from "vitest";
import { chunkText } from "@/services/documents/chunker";

describe("chunkText", () => {
  it("returns an empty array for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("returns a single chunk when text fits within chunkSize", () => {
    const chunks = chunkText("short text", { chunkSize: 800, overlap: 100 });
    expect(chunks).toEqual(["short text"]);
  });

  it("splits long text into overlapping chunks that preserve boundary context", () => {
    const text = Array.from({ length: 2000 }, (_, i) => String(i % 10)).join("");
    const chunks = chunkText(text, { chunkSize: 800, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);

    const step = 800 - 100;
    const first = chunks[0]!;
    const second = chunks[1]!;
    // second chunk starts at `step`, so its first `overlap` chars should
    // equal the tail of the first chunk at that same absolute position.
    expect(second.slice(0, 100)).toBe(first.slice(step, step + 100));
  });
});
