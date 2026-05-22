// Pure AI-grading helper for flashcard answers. Builds the prompt, calls
// the configured AI provider (cloud key, WebLLM, or local Claude bridge),
// parses the JSON response, and returns { rating, label, explanation,
// source }. Side-effect free — callers manage their own loading state.
//
// Used by FlashcardApp's legacy fullscreen submitGuess flow AND by the
// in-Tool-Bar study session inside CardsTab. Extracting it here avoids
// duplicating the prompt and lets both paths share grading behavior.

import { gradeAnswer } from "./aiGrader.js";
import { gradeWithLocal } from "./webllm.js";
import { quickGrade } from "./quickGrade.js";

const TAG_RULES = {
  spelling:    "SPELLING: Exact spelling matters. Misspelled words should lower the rating even if the meaning is correct.",
  vocabulary:  "VOCABULARY: The student should use the precise term or word, not just describe the concept.",
  definition:  "DEFINITION: Grade on completeness and accuracy of the definition.",
  concept:     "CONCEPT: Understanding the idea matters more than exact wording.",
  formula:     "FORMULA: Exact notation and structure matter. Close but incorrect formulas should be rated lower.",
  date:        "DATE: The exact date/year matters. Close dates should be rated Hard, not Good.",
  name:        "NAME: The exact name matters. Partial names or misspellings should be rated lower.",
  translation: "TRANSLATION: The translated word or phrase must be accurate. Synonyms may be acceptable if common.",
  diagram:     "DIAGRAM: Focus on whether the student described the key elements correctly.",
};

function buildTagContext(tags) {
  if (!tags || tags.length === 0) return "";
  const lines = tags.map(t => "- " + (TAG_RULES[t] || `${t.toUpperCase()}: Grade with this focus area in mind.`));
  return `\nCARD TAGS: ${tags.join(", ")}\nThese tags indicate what this card is testing. Adjust your grading accordingly:\n${lines.join("\n")}`;
}

const STRICTNESS_RULE = {
  Lenient:  "GRADING STANCE: Be generous — reward partial understanding, give the benefit of the doubt on minor omissions, and lean toward the higher rating when it's borderline.",
  Strict:   "GRADING STANCE: Be demanding — require precise, complete answers. Penalize missing specifics and vagueness, and lean toward the lower rating when it's borderline.",
};

function buildPrompt({ correctAnswer, studentAnswer, tags, strictness }) {
  const tagContext = buildTagContext(tags);
  const tagHint = tags?.length > 0
    ? ` Mention the tag-specific criteria you applied (e.g. "your spelling was accurate" or "the exact date was off — you said X").`
    : "";
  const strictnessLine = STRICTNESS_RULE[strictness] ? `\n${STRICTNESS_RULE[strictness]}` : "";
  return `You are a warm, encouraging teacher grading a flashcard answer. Be honest about accuracy while always staying supportive and positive.

CRITICAL VOICE: Address the user DIRECTLY using "you" / "your" in your explanation. Do NOT write "the student", "they", "the user", or any third-person reference — speak to them, not about them.

GRADING RULES:
- Ignore differences in whitespace, capitalization, and punctuation unless a tag requires exactness.
- Focus on meaning, completeness, and specificity.
- Perfect should be RARE — reserve for full understanding matching the correct answer in meaning AND completeness.
- Match the level of detail. A vague answer to a specific question rates lower.
- Be fair but not generous.${strictnessLine}
${tagContext}

CORRECT ANSWER: "${correctAnswer}"

STUDENT'S ANSWER: "${studentAnswer}"

Rate:
0 = "Forgot" — completely wrong or unrelated
2 = "Hard" — got a piece right but missing the main point
3 = "Good" — right general idea but lacking specifics
4 = "Easy" — correct and fairly complete
5 = "Perfect" — full understanding, matching in meaning AND completeness

Keep your explanation to 1-2 sentences, addressed to "you".${tagHint}

Respond ONLY with valid JSON, no markdown backticks:
{"rating": <number>, "label": "<Forgot|Hard|Good|Easy|Perfect>", "explanation": "<1-2 sentences>"}`;
}

export async function gradeCardAnswer({ card, guess, aiSettings, strictness = "Balanced" }) {
  const correctAnswer = card.back?.text || "(drawing or audio — no text answer)";
  const tags = card.tags || [];

  // Deterministic short-circuit for clear-cut short factual answers.
  // Skipped under Strict grading so exact-but-incomplete answers still
  // go through the model rather than auto-passing.
  if (strictness !== "Strict") {
    const quick = quickGrade({ correctAnswer, studentAnswer: guess });
    if (quick) return { ...quick, source: "quick" };
  }

  try {
    if (aiSettings?.useLocal) {
      const parsed = await gradeWithLocal({
        modelId: aiSettings.localModelId,
        correctAnswer, studentAnswer: guess, tags,
      });
      return { ...parsed, source: "local" };
    }
    if (aiSettings?.provider !== "claude-local" && !aiSettings?.apiKey) {
      throw new Error("No API key");
    }
    const prompt = buildPrompt({ correctAnswer, studentAnswer: guess, tags, strictness });
    const parsed = await gradeAnswer(aiSettings, prompt);
    return { ...parsed, source: "cloud" };
  } catch (err) {
    console.error("AI grading error:", err);
    return {
      rating: 3, label: "Good",
      explanation: "Could not reach AI grader. Please rate manually.",
      source: "fallback",
    };
  }
}
