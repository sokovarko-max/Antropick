import mammoth from "mammoth";
import type { SupportedDocType } from "./validateFile";

/**
 * Extracts plain text from an already-validated file. Runs in the frontend
 * since parsing is pure computation with no OS dependency — see
 * docs/architecture.md §8. Output is treated as untrusted text downstream
 * (never interpolated into HTML unescaped — see docs/security.md).
 */
export async function extractText(docType: SupportedDocType, bytes: Uint8Array): Promise<string> {
  switch (docType) {
    case "txt":
    case "md":
      return new TextDecoder("utf-8").decode(bytes);
    case "docx": {
      const result = await mammoth.extractRawText({ arrayBuffer: toArrayBuffer(bytes) });
      return result.value;
    }
    case "pdf":
      return extractPdfText(bytes);
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }
  return pageTexts.join("\n\n");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
