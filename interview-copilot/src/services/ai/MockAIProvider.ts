import type {
  AIGenerateRequest,
  AIProvider,
  AIResponse,
  AIStreamChunk,
  AIVisionRequest,
} from "./types";

/**
 * Deliberately absent from MODEL_PRICING, so estimateCostUsd returns null for
 * it and the UI shows no dollar figure for a demo answer.
 */
export const MOCK_MODEL_ID = "mock-model";

/**
 * Powers DEMO_MODE. Deterministic-ish canned responses so the full UI
 * (overlay, session analysis, chat) is exercisable with no API key.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock";

  async generate(request: AIGenerateRequest): Promise<AIResponse> {
    const text = mockTextFor(request);
    return {
      text,
      usage: { inputTokens: estimateTokens(request), outputTokens: estimateTokens({ ...request, messages: [{ role: "assistant", content: text }] }) },
      modelId: MOCK_MODEL_ID,
      stopReason: "end_turn",
    };
  }

  async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamChunk> {
    const text = mockTextFor(request);
    const words = text.split(" ");
    for (const word of words) {
      await delay(5);
      yield { delta: word + " ", done: false };
    }
    yield {
      delta: "",
      done: true,
      usage: { inputTokens: estimateTokens(request), outputTokens: words.length },
      // Tagged as the mock so downstream pricing can tell that nothing was
      // actually spent. Omitting this is what let the session view bill a
      // demo answer at Sonnet's rate.
      modelId: MOCK_MODEL_ID,
    };
  }

  async analyzeImage(request: AIVisionRequest): Promise<AIResponse> {
    return {
      text:
        request.responseLanguage === "ru"
          ? "ОТВЕТ:\nПохоже на скриншот с кодом или доской (демо-режим — реального обращения к модели не было).\n\nКЛЮЧЕВЫЕ ПУНКТЫ:\n- Демо-режим активен\n- Добавьте настоящий API-ключ в настройках, чтобы разбирать реальные скриншоты"
          : "ANSWER:\nThis looks like a coding/whiteboard screenshot (demo mode — no real vision call).\n\nKEY POINTS:\n- Demo mode is active\n- Connect a real API key in Settings to analyze real screenshots",
      usage: { inputTokens: 0, outputTokens: 0 },
      modelId: MOCK_MODEL_ID,
      stopReason: "end_turn",
    };
  }

  async analyzeConversation(request: AIGenerateRequest): Promise<AIResponse> {
    return this.generate(request);
  }
}

function mockTextFor(request: AIGenerateRequest): string {
  if (request.taskType === "QUESTION_DETECTION") {
    return JSON.stringify({
      isQuestion: true,
      questionType: "TECHNICAL_TASK",
      urgency: 0.7,
      relevance: 0.8,
      requiresVision: false,
      requiresUserProfile: true,
    });
  }
  if (request.taskType === "SESSION_ANALYSIS") {
    return JSON.stringify({
      overallScore: 74,
      categoryScores: [
        { category: "TECHNICAL", score: 78, evidence: "Demo mode — no real transcript analyzed." },
      ],
      strengths: ["Clear structure in answers (demo)"],
      weaknesses: ["Demo mode has no real transcript to evaluate"],
      missedOpportunities: [],
      redFlags: [],
      bestAnswers: [],
      weakestAnswers: [],
      recommendations: ["Connect a real API key to get a real analysis"],
    });
  }
  // The canned answer is the one thing a demo user reads, so it follows the
  // session's language like a real answer would. Hardcoding English here is
  // why the language switch looked broken to anyone without an API key.
  if (request.responseLanguage === "ru") {
    return "ОТВЕТ:\nЭто ответ демо-режима — API-ключ не настроен. В реальном ответе делайте упор на конкретные измеримые результаты из своего опыта.\n\nКЛЮЧЕВЫЕ ПУНКТЫ:\n- Демо-режим активен\n- Добавьте API-ключ в настройках, чтобы получать настоящие подсказки\n- Никогда не выдумывайте опыт, которого у кандидата нет";
  }
  return "ANSWER:\nThis is a demo-mode response — no API key is configured. Focus your real answer on concrete, measurable outcomes from your actual experience.\n\nKEY POINTS:\n- Demo mode active\n- Connect an API key in Settings for real suggestions\n- Never invent experience the candidate doesn't have";
}

function estimateTokens(request: AIGenerateRequest): number {
  const chars = request.systemPrompt.length + request.messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(chars / 4);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
