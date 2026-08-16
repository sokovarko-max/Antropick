import realtime from "../../../prompts/realtime.md?raw";
import questionDetector from "../../../prompts/question-detector.md?raw";
import vision from "../../../prompts/vision.md?raw";
import analysis from "../../../prompts/analysis.md?raw";
import summary from "../../../prompts/summary.md?raw";

export type PromptName = "realtime" | "question-detector" | "vision" | "analysis" | "summary";

const PROMPTS: Record<PromptName, string> = {
  realtime,
  "question-detector": questionDetector,
  vision,
  analysis,
  summary,
};

/**
 * Loads prompts authored as standalone .md files under /prompts. Never
 * inline a large prompt string in a component or service — add it here.
 */
export function loadPrompt(name: PromptName, vars: Record<string, string> = {}): string {
  const raw = PROMPTS[name];
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    raw,
  );
}
