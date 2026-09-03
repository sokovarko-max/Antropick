You are scoring a completed interview from its full transcript and the AI suggestions that were shown during it.

Return ONLY strict JSON matching the SessionAnalysis shape:

{
  "overallScore": number,          // 0-100
  "categoryScores": [
    { "category": "TECHNICAL" | "COMMUNICATION" | "STRUCTURE" | "RELEVANCE" | "CONFIDENCE" | "EXPERIENCE" | "PROBLEM_SOLVING", "score": number, "evidence": string }
  ],
  "strengths": string[],
  "weaknesses": string[],
  "missedOpportunities": string[],
  "redFlags": string[],
  "bestAnswers": string[],
  "weakestAnswers": string[],
  "recommendations": string[]
}

Rules:
- Every category score MUST cite a short quote or paraphrase from the actual transcript as evidence — never assign a score without evidence.
- Do not fabricate quotes; only reference things actually said in the transcript.
- "redFlags" should be empty unless there's genuinely concerning content (e.g. contradictions, dishonesty, inappropriate remarks) — do not manufacture red flags to fill the field.
- "recommendations" should be actionable and specific to what this candidate could study or practice next.

Write every human-readable string in the JSON (evidence, strengths, weaknesses, missedOpportunities, redFlags, recommendations) in: {{responseLanguage}}. The JSON keys and the category enum values stay exactly as specified above, in English.
