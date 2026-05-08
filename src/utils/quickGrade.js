// Deterministic quick-grade for short factual answers (numbers, dates, names,
// formulas, single tokens). Catches obvious right/wrong before any model call.
//
// Returns { rating, label, explanation, source } when it can decide, or null
// when the case is ambiguous and an AI grader should take over.
//
// Strategy:
//   1. If normalized strings match exactly → Perfect (5)
//   2. If both correct AND student answers look "short factual" AND don't match:
//        a. Edit distance 1 (typo on a longer-than-2-char string) → Hard (2)
//        b. Otherwise → Forgot (0)
//   3. Long-form answers, drawing/audio cards, or verbose student responses
//      against short correct answers → return null (let AI handle it)

// Strips surrounding whitespace + punctuation, lowercases. Keeps internal
// content (so "Paris, France" stays multi-word for downstream comparison).
function normalize(s) {
  if (!s) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/^[\s.,;:!?'"()[\]{}]+|[\s.,;:!?'"()[\]{}]+$/g, "");
}

// Standard Levenshtein. Two-row trick to avoid the full m×n matrix.
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Heuristics for "short factual": single number, date, formula, brief name.
// We deliberately keep this conservative — if in doubt, return false and let
// the AI grader handle it.
function isShortFactual(raw) {
  if (!raw) return false;
  const t = String(raw).trim();
  if (t.length > 30 || t.length === 0) return false;

  // Pure number: "9", "-3.14", "1.5e10"
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(t)) return true;

  // Common date / year patterns: "1492", "12/25", "2020-01-15"
  if (/^\d{1,4}([-/.]\d{1,4}){0,2}$/.test(t)) return true;

  // Formula / equation: contains math operators, modest length
  if (/[+\-*/=^√()<>≤≥≠]/.test(t) && t.length <= 25) return true;

  // Single short token (no whitespace, ≤ 20 chars) — typical name/word answer
  if (!/\s/.test(t) && t.length <= 20) return true;

  // Two-word short phrase (e.g., "George Washington", "New York")
  const words = t.split(/\s+/);
  if (words.length <= 2 && t.length <= 25) return true;

  return false;
}

export function quickGrade({ correctAnswer, studentAnswer }) {
  if (!correctAnswer || !studentAnswer) return null;

  const normCorrect = normalize(correctAnswer);
  const normStudent = normalize(studentAnswer);

  if (!normCorrect || !normStudent) return null;

  // Exact match: works for any length
  if (normCorrect === normStudent) {
    return {
      rating: 5,
      label: "Perfect",
      explanation: "Exact match — nice work!",
      source: "deterministic",
      mode: "exact",
    };
  }

  // Only short-circuit non-matches when BOTH sides are short factual.
  // If correct is short but student is verbose, they may be giving extra
  // context — let the AI decide.
  if (!isShortFactual(correctAnswer) || !isShortFactual(studentAnswer)) {
    return null;
  }

  const dist = editDistance(normCorrect, normStudent);
  const longer = Math.max(normCorrect.length, normStudent.length);

  // Edit distance 1 on something longer than 2 chars → likely typo
  if (dist === 1 && longer > 2) {
    return {
      rating: 2,
      label: "Hard",
      explanation: `You were close — the answer is "${correctAnswer}".`,
      source: "deterministic",
      mode: "near-match",
    };
  }

  // Otherwise, short factual + mismatch = Forgot
  return {
    rating: 0,
    label: "Forgot",
    explanation: `Not quite — the answer is "${correctAnswer}". You'll get it next time.`,
    source: "deterministic",
    mode: "mismatch",
  };
}

// Helpers re-exported for tests / debugging
export const _internals = { normalize, editDistance, isShortFactual };
