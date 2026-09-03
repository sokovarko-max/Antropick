import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NewSessionPage } from "@/pages/NewSessionPage";
import { useSettingsStore } from "@/stores/settingsStore";
import { VisionService } from "@/services/vision/VisionService";
import { SessionAnalysisService } from "@/services/session/SessionAnalysisService";
import { languageName, loadPrompt } from "@/services/prompts/PromptLoader";
import type { AIProvider, AIResponse } from "@/services/ai/types";

function recordingProvider(text: string) {
  const response: AIResponse = {
    text,
    usage: { inputTokens: 1, outputTokens: 1 },
    modelId: "x",
    stopReason: "end_turn",
  };
  const seen: string[] = [];
  const provider: AIProvider = {
    id: "test",
    generate: async (r) => {
      seen.push(r.systemPrompt);
      return response;
    },
    stream: async function* () {},
    analyzeImage: async (r) => {
      seen.push(r.systemPrompt);
      return response;
    },
    analyzeConversation: async () => response,
  };
  return { provider, seen };
}

const analysisJson = JSON.stringify({
  overallScore: 80,
  categoryScores: [{ category: "TECHNICAL", score: 80, evidence: "e" }],
  strengths: [],
  weaknesses: [],
  missedOpportunities: [],
  redFlags: [],
  bestAnswers: [],
  weakestAnswers: [],
  recommendations: [],
});

describe("languageName", () => {
  it("spells the language out, because a bare locale code is only a hint", () => {
    expect(languageName("ru")).toBe("Russian");
    expect(languageName("en")).toBe("English");
  });
});

describe("prompt templates", () => {
  it("leaves no unsubstituted placeholder in any prompt that takes a language", () => {
    // A stray {{responseLanguage}} reaching the model is worse than useless:
    // it reads as an instruction to answer in a language called
    // "{{responseLanguage}}".
    for (const name of ["realtime", "vision", "analysis"] as const) {
      const filled = loadPrompt(name, {
        responseLanguage: "Russian",
        responseMode: "SHORT",
        framework: "no specific framework",
      });
      expect(filled).not.toMatch(/\{\{\w+\}\}/);
      expect(filled).toContain("Russian");
    }
  });
});

describe("VisionService", () => {
  it("asks for the answer in the session's language", async () => {
    // The reported bug: switching the app to Russian left screenshot answers
    // in English, because the vision prompt carried no language at all.
    const { provider, seen } = recordingProvider("ANSWER:\nok");
    await new VisionService(provider).analyze({
      imageBase64: "AAAA",
      mediaType: "image/png",
      recentTranscript: [],
      responseLanguage: "ru",
    });
    expect(seen[0]).toContain("Response language: Russian");
  });

  it("does not name a language the session did not ask for", async () => {
    const { provider, seen } = recordingProvider("ANSWER:\nok");
    await new VisionService(provider).analyze({
      imageBase64: "AAAA",
      mediaType: "image/png",
      recentTranscript: [],
      responseLanguage: "en",
    });
    expect(seen[0]).toContain("Response language: English");
    expect(seen[0]).not.toContain("Russian");
  });
});

describe("SessionAnalysisService", () => {
  it("asks for the scored write-up in the session's language", async () => {
    const { provider, seen } = recordingProvider(analysisJson);
    await new SessionAnalysisService(provider).analyze("s1", [], [], "ru");
    expect(seen[0]).toContain("Russian");
  });

  it("keeps the JSON contract in English so parsing survives the translation", async () => {
    // Only the prose fields are translated — a Russian category name would
    // fail the enum in the Zod schema and lose the whole analysis.
    const { provider, seen } = recordingProvider(analysisJson);
    const result = await new SessionAnalysisService(provider).analyze("s1", [], [], "ru");
    expect(seen[0]).toMatch(/keys and the category enum values stay exactly as specified/i);
    expect(result.categoryScores[0]?.category).toBe("TECHNICAL");
  });
});

describe("new sessions", () => {
  function renderNewSession() {
    return render(
      <MemoryRouter>
        <NewSessionPage />
      </MemoryRouter>,
    );
  }

  function languageSelect(): HTMLSelectElement {
    // The form has several selects; this is the one listing the two languages.
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const found = selects.find((s) =>
      [...s.options].every((o) => o.value === "en" || o.value === "ru"),
    );
    if (!found) throw new Error("no response-language select found");
    return found;
  }

  it("defaults the answer language to the language the app is set to", () => {
    // Hardcoding "en" here is what made a Russian UI still answer in English:
    // every label translated, and the one field that decides the answer
    // language quietly stayed on English.
    useSettingsStore.setState({ locale: "ru" });
    renderNewSession();
    expect(languageSelect().value).toBe("ru");
  });

  it("defaults to English for an English UI", () => {
    useSettingsStore.setState({ locale: "en" });
    renderNewSession();
    expect(languageSelect().value).toBe("en");
  });
});
