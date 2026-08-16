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

  setState: (state: OverlayState) => void;
  setQuestion: (question: string) => void;
  appendAnswerDelta: (delta: string) => void;
  setAnswer: (answer: string, keyPoints: string[]) => void;
  setError: (message: string) => void;
  reset: () => void;
  togglePause: () => void;
  setVisible: (visible: boolean) => void;
}

export const useOverlayStore = create<OverlayStoreState>()((set) => ({
  state: "IDLE",
  question: null,
  answer: "",
  keyPoints: [],
  errorMessage: null,
  isPaused: false,
  isVisible: true,

  setState: (state) => set({ state }),
  setQuestion: (question) => set({ question, state: "THINKING", answer: "", keyPoints: [] }),
  appendAnswerDelta: (delta) => set((s) => ({ answer: s.answer + delta, state: "ANSWERING" })),
  setAnswer: (answer, keyPoints) => set({ answer, keyPoints, state: "ANSWERING" }),
  setError: (message) => set({ errorMessage: message, state: "ERROR" }),
  reset: () => set({ state: "IDLE", question: null, answer: "", keyPoints: [], errorMessage: null }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  setVisible: (visible) => set({ isVisible: visible }),
}));
