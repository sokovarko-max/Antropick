import { describe, expect, it } from "vitest";
import { validateFile } from "@/services/documents/validateFile";

describe("validateFile", () => {
  it("accepts a valid PDF magic byte header", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const result = validateFile("resume.pdf", bytes);
    expect(result.ok).toBe(true);
    expect(result.docType).toBe("pdf");
  });

  it("rejects a .pdf extension with the wrong magic bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const result = validateFile("fake.pdf", bytes);
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported extension", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = validateFile("resume.exe", bytes);
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateFile("resume.txt", new Uint8Array());
    expect(result.ok).toBe(false);
  });

  it("accepts plain txt/md regardless of content", () => {
    const bytes = new TextEncoder().encode("hello world");
    expect(validateFile("notes.txt", bytes).ok).toBe(true);
    expect(validateFile("notes.md", bytes).ok).toBe(true);
  });
});
