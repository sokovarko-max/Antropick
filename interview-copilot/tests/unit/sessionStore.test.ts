import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore, type PendingUpload } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { setPersistenceAdapter } from "@/services/persistence";
import type { PersistenceAdapter } from "@/services/persistence/types";
import type { DocumentChunk, TranscriptSegment, UploadedDocument } from "@/types";

function fakeAdapter() {
  const calls = {
    sessions: [] as string[],
    transcripts: [] as TranscriptSegment[],
    documents: [] as Array<{ document: UploadedDocument; chunks: DocumentChunk[] }>,
  };
  const adapter: PersistenceAdapter = {
    id: "fake",
    loadAll: vi.fn(async () => ({
      sessions: [],
      transcripts: {},
      aiResponses: {},
      documentChunks: {},
      analyses: {},
    })),
    saveSession: vi.fn(async (session) => {
      calls.sessions.push(session.id);
    }),
    saveTranscriptSegment: vi.fn(async (segment) => {
      calls.transcripts.push(segment);
    }),
    saveAiResponse: vi.fn(async () => {}),
    saveDocument: vi.fn(async (document, chunks) => {
      calls.documents.push({ document, chunks });
    }),
    saveAnalysis: vi.fn(async () => {}),
    deleteSession: vi.fn(async () => {}),
  };
  return { adapter, calls };
}

const newSessionInput = {
  title: "Senior Engineer",
  role: "Senior Engineer",
  company: "Acme",
  mode: "AUTO" as const,
  responseLanguage: "en" as const,
  responseMode: "SHORT" as const,
  framework: "NONE" as const,
  userInstructions: "",
};

function pendingUpload(): PendingUpload {
  return {
    document: {
      id: "doc1",
      sessionId: "pending",
      docType: "RESUME",
      originalFileName: "cv.pdf",
      storageFileName: "uuid.txt",
      uploadedAtMs: 1,
    },
    chunks: [
      {
        id: "c1",
        documentId: "doc1",
        sessionId: "pending",
        docType: "RESUME",
        text: "experience",
        order: 0,
      },
    ],
  };
}

/** Persistence writes are fire-and-forget; let the microtask queue drain. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      transcripts: {},
      aiResponses: {},
      documentChunks: {},
      analyses: {},
      activeSessionId: null,
      pendingUploads: [],
      isHydrated: false,
    });
    useSettingsStore.setState({
      privacy: {
        saveTranscript: true,
        saveScreenshots: false,
        saveAudio: false,
        cloudProcessing: true,
      },
    });
  });

  it("re-keys documents uploaded before the session existed onto the new session", async () => {
    const { adapter, calls } = fakeAdapter();
    setPersistenceAdapter(adapter);

    useSessionStore.getState().addPendingUpload(pendingUpload());
    expect(useSessionStore.getState().pendingUploads).toHaveLength(1);

    const session = useSessionStore.getState().createSession(newSessionInput);
    await flush();

    // Nothing is left dangling under the "pending" key.
    const state = useSessionStore.getState();
    expect(state.pendingUploads).toHaveLength(0);
    expect(state.documentChunks["pending"]).toBeUndefined();
    expect(state.documentChunks[session.id]).toHaveLength(1);
    expect(state.documentChunks[session.id]?.[0]?.sessionId).toBe(session.id);

    // ...and the persisted copy carries the real session id too.
    expect(calls.documents).toHaveLength(1);
    expect(calls.documents[0]!.document.sessionId).toBe(session.id);
    expect(calls.documents[0]!.chunks[0]!.sessionId).toBe(session.id);
  });

  it("persists the session before its documents, so the foreign key holds", async () => {
    const { adapter } = fakeAdapter();
    setPersistenceAdapter(adapter);
    const order: string[] = [];
    vi.mocked(adapter.saveSession).mockImplementation(async () => void order.push("session"));
    vi.mocked(adapter.saveDocument).mockImplementation(async () => void order.push("document"));

    useSessionStore.getState().addPendingUpload(pendingUpload());
    useSessionStore.getState().createSession(newSessionInput);
    await flush();

    expect(order).toEqual(["session", "document"]);
  });

  it("persists transcript segments when Privacy > Save transcript is on", async () => {
    const { adapter, calls } = fakeAdapter();
    setPersistenceAdapter(adapter);
    const session = useSessionStore.getState().createSession(newSessionInput);

    useSessionStore.getState().appendTranscript({
      id: "seg1",
      sessionId: session.id,
      speaker: "INTERVIEWER",
      text: "Tell me about yourself",
      timestampMs: 1,
      confidence: 0.9,
    });
    await flush();

    expect(calls.transcripts).toHaveLength(1);
  });

  it("keeps transcript in memory but off disk when Save transcript is off", async () => {
    const { adapter, calls } = fakeAdapter();
    setPersistenceAdapter(adapter);
    const session = useSessionStore.getState().createSession(newSessionInput);
    useSettingsStore.setState({
      privacy: {
        saveTranscript: false,
        saveScreenshots: false,
        saveAudio: false,
        cloudProcessing: true,
      },
    });

    useSessionStore.getState().appendTranscript({
      id: "seg1",
      sessionId: session.id,
      speaker: "INTERVIEWER",
      text: "sensitive",
      timestampMs: 1,
      confidence: 0.9,
    });
    await flush();

    expect(calls.transcripts).toHaveLength(0);
    // Still available to the running session.
    expect(useSessionStore.getState().transcripts[session.id]).toHaveLength(1);
  });

  it("survives a failing persistence adapter without losing in-memory state", async () => {
    const { adapter } = fakeAdapter();
    vi.mocked(adapter.saveSession).mockRejectedValue(new Error("disk full"));
    setPersistenceAdapter(adapter);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const session = useSessionStore.getState().createSession(newSessionInput);
    await flush();

    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(useSessionStore.getState().activeSessionId).toBe(session.id);
  });

  it("hydrate() restores persisted state and is idempotent", async () => {
    const { adapter } = fakeAdapter();
    vi.mocked(adapter.loadAll).mockResolvedValue({
      sessions: [
        {
          id: "old",
          title: "Previous interview",
          role: "",
          company: "",
          startTimeMs: 1,
          endTimeMs: 2,
          mode: "AUTO",
          modelProfileOverride: null,
          responseLanguage: "en",
          responseMode: "SHORT",
          framework: "NONE",
          userInstructions: "",
          summary: null,
        },
      ],
      transcripts: {},
      aiResponses: {},
      documentChunks: {},
      analyses: {},
    });
    setPersistenceAdapter(adapter);

    await useSessionStore.getState().hydrate();
    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(adapter.loadAll).toHaveBeenCalledTimes(1);
  });

  it("deleteSession removes the session and all of its child data", async () => {
    const { adapter } = fakeAdapter();
    setPersistenceAdapter(adapter);
    const session = useSessionStore.getState().createSession(newSessionInput);
    useSessionStore.getState().appendTranscript({
      id: "seg1",
      sessionId: session.id,
      speaker: "CANDIDATE",
      text: "hi",
      timestampMs: 1,
      confidence: 1,
    });

    useSessionStore.getState().deleteSession(session.id);
    await flush();

    const state = useSessionStore.getState();
    expect(state.sessions).toHaveLength(0);
    expect(state.transcripts[session.id]).toBeUndefined();
    expect(state.activeSessionId).toBeNull();
    expect(adapter.deleteSession).toHaveBeenCalledWith(session.id);
  });
});
