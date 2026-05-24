// Cloud AI grading. Each provider exposes a small set of models, focused on
// fast / cheap options well-suited to flashcard grading (~700 input + 150
// output tokens per call).
//
// `recommended: true` flags the best default for grading. Heavier "flagship"
// models are included for users who want them but are usually overkill.
//
// To add a new model: just append { id, name, note, recommended? } to the
// provider's `models` array. The UI displays `name` and uses `id` for the API
// call. To bump the default, change `defaultModel`.

const PROVIDERS = {
  anthropic: {
    name: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    defaultModel: "claude-haiku-4-5",
    models: [
      { id: "claude-haiku-4-5",  name: "Claude Haiku 4.5",  note: "Fast & cheap",  recommended: true },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", note: "Balanced" },
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", note: "Older balanced" },
      { id: "claude-opus-4-5",   name: "Claude Opus 4.5",   note: "Highest quality (slow, expensive)" },
    ],
  },
  openai: {
    name: "OpenAI (ChatGPT)",
    placeholder: "sk-...",
    defaultModel: "gpt-5-mini",
    models: [
      { id: "gpt-5-nano",   name: "GPT-5 nano",   note: "Cheapest" },
      { id: "gpt-5-mini",   name: "GPT-5 mini",   note: "Recommended for grading", recommended: true },
      { id: "gpt-5",        name: "GPT-5",        note: "Flagship" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 mini", note: "Older balanced" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 nano", note: "Older cheapest" },
      { id: "gpt-4o-mini",  name: "GPT-4o mini",  note: "Legacy fallback" },
    ],
  },
  google: {
    name: "Google (Gemini)",
    placeholder: "AIza...",
    defaultModel: "gemini-2.5-flash-lite",
    models: [
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", note: "Cheapest", recommended: true },
      { id: "gemini-2.5-flash",      name: "Gemini 2.5 Flash",      note: "Balanced" },
      { id: "gemini-2.5-pro",        name: "Gemini 2.5 Pro",        note: "Flagship (slow, expensive)" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", note: "Legacy cheap" },
      { id: "gemini-2.0-flash",      name: "Gemini 2.0 Flash",      note: "Legacy balanced" },
    ],
  },
  // Local-dev only: routes prompts through the locally-installed `claude`
  // CLI (Claude Code) via the Vite dev server's /_ai bridge. Uses whatever
  // OAuth login is on this machine — no API key. Not available on a
  // deployed website (the /_ai endpoint only exists under `npm run dev`),
  // so the Settings UI gates it behind isClaudeLocalAvailable().
  "claude-local": {
    name: "Claude (this device)",
    placeholder: "", // no key needed
    noKey: true,
    devOnly: true,
    defaultModel: "sonnet",
    models: [
      { id: "haiku",  name: "Claude Haiku",  note: "Fast",                 recommended: true },
      { id: "sonnet", name: "Claude Sonnet", note: "Balanced (default)" },
      { id: "opus",   name: "Claude Opus",   note: "Best, slowest" },
    ],
  },
};

async function callAnthropic(apiKey, model, prompt, { maxTokens = 1000, signal } = {}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(b => b.text || "").join("") || "";
}

async function callOpenAI(apiKey, model, prompt, { maxTokens = 1000, signal } = {}) {
  const isNewFamily = /^(gpt-5|o[134])/i.test(model);
  const tokenField = isNewFamily ? "max_completion_tokens" : "max_tokens";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      [tokenField]: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

async function callGoogle(apiKey, model, prompt, { maxTokens = 1000, signal } = {}) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Bridge into the locally-installed `claude` CLI via the Vite dev
// server's `POST /_ai/complete` endpoint (see vite-plugin-claude-bridge),
// which wraps `claude --print`. This only exists during `npm run dev` —
// a deployed website has no such endpoint, so claude-local is a
// local-development convenience. Cloud providers work everywhere.
async function callClaudeLocal(model, prompt, { signal } = {}) {
  const res = await fetch("/_ai/complete", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Claude (local) failed: ${msg || res.status}`);
  }
  return res.text();
}

// True if the user has the credentials needed for cloud-AI features
// (chat, PDF conversion, flashcard generation). Covers both the keyed
// providers and the keyless claude-local — anywhere in the renderer
// that gates a feature on "do we have AI?" should call this rather than
// inspecting aiSettings.apiKey directly.
export function hasAiCredentials(settings) {
  if (!settings) return false;
  if (settings.provider === "claude-local") return true;
  return !!settings.apiKey;
}

// True if the dev-only Claude (local) provider can be used here. Probes
// both transports; the renderer awaits this once at mount.
//
// Probes the Vite dev middleware at /_ai/available. Returns false on a
// deployed website (the endpoint only exists under `npm run dev`), which
// is the correct signal — claude-local isn't available there.
export async function isClaudeLocalAvailable() {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/_ai/available", { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.ok;
  } catch { return false; }
}

// Generic text-completion across providers — used by features beyond grading
// (PDF→Markdown conversion, summarization, etc).
export async function callAi(settings, prompt, options = {}) {
  const { provider, apiKey, model } = settings;
  const { maxTokens = 1000, signal, timeout = 180000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (signal) {
    if (signal.aborted) { clearTimeout(timer); throw new DOMException("Aborted", "AbortError"); }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const opts = { maxTokens, signal: controller.signal };

  try {
    if (provider === "claude-local") return await callClaudeLocal(model, prompt, opts);
    if (!apiKey) throw new Error("No API key configured");
    if (provider === "anthropic") return await callAnthropic(apiKey, model, prompt, opts);
    if (provider === "openai") return await callOpenAI(apiKey, model, prompt, opts);
    if (provider === "google") return await callGoogle(apiKey, model, prompt, opts);
    throw new Error("Unknown provider");
  } catch (err) {
    if (err.name === "AbortError" && !signal?.aborted) {
      throw new Error("AI request timed out — try a smaller PDF or check your connection.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function gradeAnswer(settings, prompt) {
  const text = await callAi(settings, prompt);

  const clean = text.replace(/```json|```/g, "").trim();
  // Forgiving JSON extraction: pull the first {...} object even if the model
  // wraps it in prose.
  const jsonMatch = clean.match(/\{[\s\S]*?\}/);
  const candidate = jsonMatch ? jsonMatch[0] : clean;
  return JSON.parse(candidate);
}

export { PROVIDERS };
