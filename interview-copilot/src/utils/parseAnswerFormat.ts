export interface ParsedAnswer {
  answer: string;
  keyPoints: string[];
  optionalExample: string | null;
}

/** Parses the ANSWER / KEY POINTS / OPTIONAL EXAMPLE format from prompts/realtime.md. */
export function parseAnswerFormat(raw: string): ParsedAnswer {
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
