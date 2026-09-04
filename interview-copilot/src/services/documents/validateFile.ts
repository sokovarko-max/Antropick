const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const MAGIC_BYTES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  docx: [0x50, 0x4b, 0x03, 0x04], // ZIP local file header (docx is a zip)
};

export type SupportedDocType = "pdf" | "docx" | "txt" | "md";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  docType?: SupportedDocType;
}

/**
 * Extension + magic-byte validation before parsing — see docs/security.md
 * (untrusted file uploads). Never trust the extension alone.
 */
export function validateFile(fileName: string, bytes: Uint8Array): ValidationResult {
  if (bytes.byteLength === 0) return { ok: false, reason: "Empty file" };
  if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, reason: "File too large" };

  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    return matchesMagic(bytes, MAGIC_BYTES.pdf!)
      ? { ok: true, docType: "pdf" }
      : { ok: false, reason: "File does not look like a valid PDF" };
  }
  if (ext === "docx") {
    return matchesMagic(bytes, MAGIC_BYTES.docx!)
      ? { ok: true, docType: "docx" }
      : { ok: false, reason: "File does not look like a valid DOCX" };
  }
  if (ext === "txt") return { ok: true, docType: "txt" };
  if (ext === "md") return { ok: true, docType: "md" };

  return { ok: false, reason: `Unsupported file type: .${ext ?? "unknown"}` };
}

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.byteLength < magic.length) return false;
  return magic.every((byte, i) => bytes[i] === byte);
}
