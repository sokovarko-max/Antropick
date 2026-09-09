export interface ParsedAnswer {
  answer: string;
  keyPoints: string[];
  optionalExample: string | null;
}

/**
 * Strips a reasoning model's chain-of-thought before anything else reads the
 * text.
 *
 * Reasoning models (Qwen, which serves VISION, and the gpt-oss family) wrap
 * their scratchpad in `<think>…</think>`. It is not an answer, it is several
 * hundred words of deliberation, and it arrives *before* the real answer — so
 * a candidate mid-interview gets a wall of the model talking to itself where
 * a two-sentence answer should be. An unterminated block is also handled: a
 * response cut off by a token limit while still thinking has an opening tag
 * and no closing one, and keeping that text would be strictly worse than
 * showing nothing.
 */
export function stripReasoning(raw: string): string {
  return raw
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, "")
    .trim();
}

/** Parses the ANSWER / KEY POINTS / OPTIONAL EXAMPLE format from prompts/realtime.md. */
export function parseAnswerFormat(rawWithReasoning: string): ParsedAnswer {
  const raw = stripReasoning(rawWithReasoning);
  const answerMatch = raw.match(/ANSWER:\s*([\s\S]*?)(?=KEY POINTS:|OPTIONAL EXAMPLE:|$)/i);
  const keyPointsMatch = raw.match(/KEY POINTS:\s*([\s\S]*?)(?=OPTIONAL EXAMPLE:|$)/i);
  const exampleMatch = raw.match(/OPTIONAL EXAMPLE:\s*([\s\S]*)$/i);

  const keyPoints = keyPointsMatch
    ? keyPointsMatch[1]!
        .split("\n")
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter((line) => line.length > 0)
    : [];

  return {
    answer: (answerMatch?.[1] ?? raw).trim(),
    keyPoints,
    optionalExample: exampleMatch?.[1]?.trim() || null,
  };
}
