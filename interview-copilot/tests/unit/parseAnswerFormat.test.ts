import { describe, expect, it } from "vitest";
import { parseAnswerFormat } from "@/utils/parseAnswerFormat";

describe("parseAnswerFormat", () => {
  it("splits ANSWER and KEY POINTS sections", () => {
    const raw = "ANSWER:\nI focused on reliability and team expertise.\n\nKEY POINTS:\n- Reliability\n- Team familiarity\n- Strong tooling";
    const result = parseAnswerFormat(raw);
    expect(result.answer).toBe("I focused on reliability and team expertise.");
    expect(result.keyPoints).toEqual(["Reliability", "Team familiarity", "Strong tooling"]);
    expect(result.optionalExample).toBeNull();
  });

  it("captures OPTIONAL EXAMPLE when present", () => {
    const raw = "ANSWER:\nShort answer.\n\nKEY POINTS:\n- point one\n\nOPTIONAL EXAMPLE:\nAt my last job I did X.";
    const result = parseAnswerFormat(raw);
    expect(result.optionalExample).toBe("At my last job I did X.");
  });

  it("falls back to treating the whole text as the answer when unformatted", () => {
    const result = parseAnswerFormat("Just a plain response with no headers.");
    expect(result.answer).toBe("Just a plain response with no headers.");
    expect(result.keyPoints).toEqual([]);
  });
});

describe("reasoning models", () => {
  it("drops a <think> block instead of showing it as the answer", () => {
    // Reported verbatim: a screenshot answer arrived as several hundred words
    // of the model deliberating with itself, with the real answer buried at
    // the end. Qwen serves VISION and always thinks out loud.
    const raw =
      "<think>\nThe user wants me to analyse a screenshot.\n**1. Identify what is shown:**\n- A desktop app.\n</think>\n\nANSWER:\nA settings screen.\n\nKEY POINTS:\n- Russian is selected";
    const result = parseAnswerFormat(raw);
    expect(result.answer).toBe("A settings screen.");
    expect(result.answer).not.toContain("<think>");
    expect(result.answer).not.toContain("deliberating");
    expect(result.keyPoints).toEqual(["Russian is selected"]);
  });

  it("does not fall back to showing the scratchpad when the answer is unformatted", () => {
    // The fallback path returns the whole text when there are no headers, so
    // stripping has to happen before it, not after.
    const result = parseAnswerFormat("<think>internal notes</think>\nJust the answer.");
    expect(result.answer).toBe("Just the answer.");
  });

  it("shows nothing rather than raw thinking when the model was cut off mid-thought", () => {
    // A response truncated by maxTokens has an opening tag and no closing one.
    const result = parseAnswerFormat("<think>Let me work through this care");
    expect(result.answer).toBe("");
  });

  it("handles the other tag names reasoning models use", () => {
    expect(parseAnswerFormat("<thinking>x</thinking>ANSWER:\nok").answer).toBe("ok");
    expect(parseAnswerFormat("<reasoning>x</reasoning>ANSWER:\nok").answer).toBe("ok");
  });

  it("leaves ordinary answers that merely discuss thinking untouched", () => {
    // The word must not be enough to trigger stripping — only the tag.
    const raw = "ANSWER:\nI think the bottleneck was the N+1 query.";
    expect(parseAnswerFormat(raw).answer).toBe("I think the bottleneck was the N+1 query.");
  });
});
