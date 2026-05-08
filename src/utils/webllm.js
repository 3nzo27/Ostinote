// WebLLM wrapper: lazy-loads an on-device LLM, runs grading prompts.
// First call triggers ~1GB download (cached in browser IndexedDB after that).
//
// Models, ordered by size/quality:
//   Qwen2.5-0.5B-Instruct-q4f16_1-MLC   ~400 MB  (smallest, fastest, weakest)
//   Qwen2.5-1.5B-Instruct-q4f16_1-MLC   ~1.0 GB  (sweet spot for grading)
//   Llama-3.2-3B-Instruct-q4f16_1-MLC   ~2.0 GB  (best quality of small models)
//
// Requires WebGPU (Chrome 113+, Edge 113+, Safari 18+, Electron Chromium).

let enginePromise = null;
let activeModel = null;
let engineReady = false;

const DOWNLOADED_KEY = "ostinote_webllm_downloaded";

function getDownloadedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(DOWNLOADED_KEY) || "[]")); }
  catch { return new Set(); }
}

function markDownloaded(modelId) {
  const set = getDownloadedSet();
  if (!set.has(modelId)) {
    set.add(modelId);
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify([...set]));
  }
}

// Has this model been fully downloaded to IndexedDB at least once on this device?
export function isModelDownloaded(modelId) {
  return getDownloadedSet().has(modelId);
}

// Is the engine currently loaded in memory for the given model?
export function isEngineReady(modelId) {
  if (!modelId) return engineReady && activeModel !== null;
  return engineReady && activeModel === modelId;
}

export function getActiveModelId() {
  return engineReady ? activeModel : null;
}

export const SUGGESTED_MODELS = [
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 0.5B", sizeMb: 400, note: "Fastest, weakest" },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 1.5B", sizeMb: 1000, note: "Recommended" },
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B", sizeMb: 2000, note: "Higher quality" },
];

export const DEFAULT_MODEL = SUGGESTED_MODELS[1].id;

export function isWebGpuAvailable() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

// Loads the engine if not already loaded. Calls onProgress({ progress, text })
// during the first download. Subsequent calls return the cached engine quickly.
export async function getEngine(modelId = DEFAULT_MODEL, onProgress) {
  if (!isWebGpuAvailable()) {
    throw new Error("WebGPU is not available in this browser");
  }
  if (enginePromise && activeModel === modelId) {
    return enginePromise;
  }
  // Different model requested → discard previous engine
  if (enginePromise && activeModel !== modelId) {
    engineReady = false;
    try {
      const prev = await enginePromise;
      await prev.unload?.();
    } catch {}
    enginePromise = null;
  }

  activeModel = modelId;
  engineReady = false;
  enginePromise = (async () => {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        try { onProgress?.(report); } catch {}
      },
    });
    engineReady = true;
    markDownloaded(modelId);
    return engine;
  })();
  return enginePromise;
}

export async function unloadEngine() {
  if (!enginePromise) return;
  try {
    const engine = await enginePromise;
    await engine.unload?.();
  } catch {}
  enginePromise = null;
  activeModel = null;
  engineReady = false;
}

// Runs a single grading call with the cached engine.
// Streams the response (so the UI can show progress and you can see slow generation).
// Returns { rating, label, explanation, ms, tokensOut, tokensPerSec, raw }.
//
// onTokenProgress(partialText) is called for every streamed chunk.
// timeoutMs caps total generation time (default 90s). If exceeded, throws.
export async function gradeWithLocal({
  modelId = DEFAULT_MODEL,
  correctAnswer,
  studentAnswer,
  tags = [],
  onProgress,
  onTokenProgress,
  timeoutMs = 90000,
}) {
  const engine = await getEngine(modelId, onProgress);

  const tagContext = buildTagContext(tags);
  // Note: no `response_format: json_object` — WebLLM's constrained JSON mode
  // can hang on small models. We just ask politely and parse forgivingly.
  const systemPrompt = `You are a warm, encouraging teacher grading a flashcard answer. Be honest about accuracy while staying supportive.

VOICE: Address the user DIRECTLY in your explanation using "you" / "your". Never write "the student", "they", or "the user". Speak TO them, not about them.
✓ "You got the spelling right but missed the year."
✓ "Close — the answer is 'Paris'. You'll get it next time."
✗ "The student got it wrong."
✗ "They were close."

GRADING RULES:
- Ignore differences in whitespace, capitalization, and punctuation unless a tag specifically requires exactness.
- Focus on whether the meaning is correct.
- Perfect should be RARE — reserve for full understanding matching the correct answer in meaning AND completeness.
- Match level of detail. A vague answer to a specific question rates lower.
- Be fair but not generous.
${tagContext}

RATING SCALE:
0 = "Forgot" — completely wrong or unrelated
2 = "Hard" — got a piece right but missing the main point
3 = "Good" — right general idea but lacking specifics
4 = "Easy" — correct and fairly complete, minor differences only
5 = "Perfect" — full understanding, matches in meaning AND completeness

Output a single JSON object on one line and STOP. Format:
{"rating": <0|2|3|4|5>, "label": "<Forgot|Hard|Good|Easy|Perfect>", "explanation": "<1-2 sentences addressed to 'you'>"}

Do not include any text before or after the JSON. Do not use code fences.`;

  const userPrompt = `CORRECT ANSWER: "${correctAnswer}"
STUDENT'S ANSWER: "${studentAnswer}"`;

  const t0 = performance.now();
  let fullText = "";
  let chunkCount = 0;

  // Build a hard timeout that races against the streaming
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Local grading timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
  });

  const generationPromise = (async () => {
    const stream = await engine.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 250,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        chunkCount++;
        try { onTokenProgress?.(fullText); } catch {}
      }
      // Heuristic early-stop: if model has produced a complete-looking JSON
      // object and started writing extra prose, bail.
      if (looksLikeCompleteJson(fullText) && fullText.length > 50 && delta && /[a-zA-Z]/.test(delta)) {
        // Continue a bit more in case it's still inside an explanation string
      }
    }
    return fullText;
  })();

  try {
    await Promise.race([generationPromise, timeoutPromise]);
  } catch (err) {
    throw new Error(err.message || "Generation failed");
  }

  const ms = performance.now() - t0;

  // Forgiving parse: pull the first {...} JSON object out of whatever was emitted
  const cleaned = fullText.replace(/```json|```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new Error(`Could not parse model output as JSON. First 120 chars: ${cleaned.slice(0, 120)}`);
  }

  // Estimate tokens (no usage in streamed responses) using a rough char/token ratio
  const tokensOut = chunkCount > 0 ? chunkCount : Math.round(fullText.length / 3.5);
  const tokensPerSec = tokensOut > 0 ? Math.round((tokensOut / ms) * 1000) : null;

  return {
    rating: parsed.rating,
    label: parsed.label,
    explanation: parsed.explanation,
    ms: Math.round(ms),
    tokensOut,
    tokensPerSec,
    raw: fullText,
  };
}

function looksLikeCompleteJson(text) {
  const lastClose = text.lastIndexOf("}");
  if (lastClose === -1) return false;
  const candidate = text.slice(0, lastClose + 1);
  try { JSON.parse(candidate); return true; } catch { return false; }
}

function buildTagContext(tags) {
  if (!tags || tags.length === 0) return "";
  const tagDescriptions = {
    spelling: "SPELLING: Exact spelling matters. Misspelled words lower the rating.",
    vocabulary: "VOCABULARY: Use the precise term, not just a description.",
    definition: "DEFINITION: Grade on completeness and accuracy.",
    concept: "CONCEPT: Understanding matters more than exact wording.",
    formula: "FORMULA: Exact notation matters.",
    date: "DATE: Exact date matters. Close dates rate Hard, not Good.",
    name: "NAME: Exact name matters. Misspellings lower the rating.",
    translation: "TRANSLATION: Translation must be accurate. Common synonyms acceptable.",
    diagram: "DIAGRAM: Focus on key elements being described correctly.",
  };
  return "\n\nTAG-SPECIFIC RULES:\n" + tags
    .map(t => "- " + (tagDescriptions[t] || `${t.toUpperCase()}: grade with this focus.`))
    .join("\n");
}
