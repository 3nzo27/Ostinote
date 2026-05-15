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
  // Dev-only: routes prompts through the locally-installed `claude` CLI
  // (Claude Code). Uses whatever OAuth login is already on this machine —
  // no API key. Only works in the Electron desktop build, since the bridge
  // lives in the main process. The Settings UI should only surface this
  // provider when `window.ostinoteAI` is present.
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

async function callAnthropic(apiKey, model, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.map(b => b.text || "").join("") || "";
}

async function callOpenAI(apiKey, model, prompt) {
  // GPT-5 and reasoning-family models (o1/o3/o4) prefer `max_completion_tokens`
  // over the legacy `max_tokens` field. Detect and route accordingly.
  const isNewFamily = /^(gpt-5|o[134])/i.test(model);
  const tokenField = isNewFamily ? "max_completion_tokens" : "max_tokens";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      [tokenField]: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

async function callGoogle(apiKey, model, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Bridge into the locally-installed `claude` CLI. Two transports, picked
// at call time:
//   1. Electron: `window.ostinoteAI.complete` exposed by preload.cjs
//   2. Vite dev: `POST /_ai/complete` served by vite-plugin-claude-bridge
// Both wrap the same underlying `claude --print` invocation in the Node
// side of the build, so behavior is identical.
async function callClaudeLocal(model, prompt) {
  // Prefer Electron's IPC when it's available — it's slightly cheaper than
  // a fetch round-trip and works in the packaged build too.
  const electronBridge = typeof window !== "undefined" ? window.ostinoteAI : null;
  if (electronBridge?.complete) {
    return electronBridge.complete({ prompt, model });
  }
  // Fallback: the Vite dev server's /_ai/complete endpoint. Only present
  // when running `npm run dev` (or `electron:dev` which builds, not dev).
  const res = await fetch("/_ai/complete", {
    method: "POST",
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
// In Electron, the preload bridge is detectable synchronously, but we
// keep the API async so the Vite-dev branch can fetch /_ai/available.
export async function isClaudeLocalAvailable() {
  if (typeof window === "undefined") return false;
  if (window.ostinoteAI?.complete) {
    try { return await window.ostinoteAI.isAvailable(); } catch { return false; }
  }
  // Probe the Vite middleware. Times out fast on production builds where
  // /_ai/* doesn't exist (the response will 404 or similar).
  try {
    const res = await fetch("/_ai/available", { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.ok;
  } catch { return false; }
}

// Generic text-completion across providers — used by features beyond grading
// (PDF→Markdown conversion, summarization, etc).
export async function callAi(settings, prompt) {
  const { provider, apiKey, model } = settings;
  if (provider === "claude-local") return callClaudeLocal(model, prompt);
  if (!apiKey) throw new Error("No API key configured");
  if (provider === "anthropic") return callAnthropic(apiKey, model, prompt);
  if (provider === "openai") return callOpenAI(apiKey, model, prompt);
  if (provider === "google") return callGoogle(apiKey, model, prompt);
  throw new Error("Unknown provider");
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
