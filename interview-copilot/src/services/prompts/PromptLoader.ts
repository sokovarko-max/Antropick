import realtime from "../../../prompts/realtime.md?raw";
import questionDetector from "../../../prompts/question-detector.md?raw";
import vision from "../../../prompts/vision.md?raw";
import analysis from "../../../prompts/analysis.md?raw";
import summary from "../../../prompts/summary.md?raw";

export type PromptName = "realtime" | "question-detector" | "vision" | "analysis" | "summary";

/** The language the model should answer the candidate in. */
export type ResponseLanguage = "en" | "ru";

/**
 * Names the language for a prompt. Written out in English because that is
 * what the models reliably follow — passing the bare locale code ("ru") is
 * read as a hint at best.
 */
export function languageName(language: ResponseLanguage): string {
  return language === "ru" ? "Russian" : "English";
}

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
