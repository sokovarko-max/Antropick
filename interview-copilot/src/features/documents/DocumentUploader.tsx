import { useRef, useState } from "react";
import { validateFile } from "@/services/documents/validateFile";
import { extractText } from "@/services/documents/DocumentParser";
import { chunkText } from "@/services/documents/chunker";
import { useSessionStore } from "@/stores/sessionStore";
import type { DocumentChunk } from "@/types";

let chunkIdCounter = 0;
function nextChunkId(): string {
  chunkIdCounter += 1;
  return `chunk_${Date.now()}_${chunkIdCounter}`;
}

export function DocumentUploader({ docType }: { docType: DocumentChunk["docType"] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "done">("idle");
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addDocumentChunks = useSessionStore((s) => s.addDocumentChunks);

  async function handleFile(file: File) {
    setError(null);
    setStatus("parsing");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateFile(file.name, bytes);
    if (!validation.ok || !validation.docType) {
      setError(validation.reason ?? "Invalid file");
      setStatus("idle");
      return;
    }

    try {
      const text = await extractText(validation.docType, bytes);
      const pieces = chunkText(text);
      // On New Session, no session exists yet at upload time; chunks are
      // tagged "pending" and re-keyed to the real session id once
      // createSession() runs (see NewSessionPage — a follow-up, not yet wired).
      const sessionId = activeSessionId ?? "pending";
      const chunks: DocumentChunk[] = pieces.map((piece, index) => ({
        id: nextChunkId(),
        documentId: `doc_${file.name}`,
        sessionId,
        docType,
        text: piece,
        order: index,
      }));
      addDocumentChunks(chunks);
      setFileName(file.name);
      setStatus("done");
    } catch {
      setError("Could not parse file");
      setStatus("idle");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="input flex items-center justify-between text-left text-ink-muted hover:border-accent/50"
      >
        <span>{fileName ?? "Choose a file (PDF, DOCX, TXT, MD)"}</span>
        {status === "parsing" && <span className="text-xs text-state-thinking">Parsing…</span>}
        {status === "done" && <span className="text-xs text-state-listening">✓</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {error && <p className="mt-1 text-xs text-state-error">{error}</p>}
    </div>
  );
}
