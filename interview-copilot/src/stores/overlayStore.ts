import { create } from "zustand";
import type { OverlayState } from "@/types";

interface OverlayStoreState {
  state: OverlayState;
  question: string | null;
  answer: string;
  keyPoints: string[];
  errorMessage: string | null;
  isPaused: boolean;
  isVisible: boolean;

  /**
   * Identifies the request the panel is currently showing. A screenshot and a
   * spoken question can be in flight at once, and the slower one's result — or
   * its error — used to land on top of the newer one's. That is how a rate
   * limit naming the *vision* model appeared under a spoken interview
   * question, describing a failure that had nothing to do with it.
   */
  requestId: number;

  setState: (state: OverlayState) => void;
  /** Returns the id to hand back to setAnswer/setError for this request. */
  setQuestion: (question: string) => number;
  appendAnswerDelta: (delta: string) => void;
  setAnswer: (answer: string, keyPoints: string[], requestId?: number) => void;
  setError: (message: string, requestId?: number) => void;
  reset: () => void;
  togglePause: () => void;
  setVisible: (visible: boolean) => void;
}

export const useOverlayStore = create<OverlayStoreState>()((set, get) => ({
  state: "IDLE",
  question: null,
  answer: "",
  keyPoints: [],
  errorMessage: null,
  isPaused: false,
  isVisible: true,
  requestId: 0,

  setState: (state) => set({ state }),
  setQuestion: (question) => {
    const requestId = get().requestId + 1;
    // Clears the previous error too: without that a failure stayed on the
    // panel across the next question.
    set({ question, state: "THINKING", answer: "", keyPoints: [], errorMessage: null, requestId });
    return requestId;
  },
  appendAnswerDelta: (delta) => set((s) => ({ answer: s.answer + delta, state: "ANSWERING" })),
  setAnswer: (answer, keyPoints, requestId) => {
    if (requestId !== undefined && requestId !== get().requestId) return;
    set({ answer, keyPoints, state: "ANSWERING", errorMessage: null });
  },
  setError: (message, requestId) => {
    // A late failure from a superseded request is dropped rather than shown
    // against whatever question is on screen now.
    if (requestId !== undefined && requestId !== get().requestId) return;
    set({ errorMessage: message, state: "ERROR" });
  },
  reset: () => set({ state: "IDLE", question: null, answer: "", keyPoints: [], errorMessage: null }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  setVisible: (visible) => set({ isVisible: visible }),
}));
