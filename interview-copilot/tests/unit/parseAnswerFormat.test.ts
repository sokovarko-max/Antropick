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
