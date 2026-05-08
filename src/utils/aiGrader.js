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

export async function gradeAnswer(settings, prompt) {
  const { provider, apiKey, model } = settings;
  if (!apiKey) throw new Error("No API key configured");

  let text;
  if (provider === "anthropic") text = await callAnthropic(apiKey, model, prompt);
  else if (provider === "openai") text = await callOpenAI(apiKey, model, prompt);
  else if (provider === "google") text = await callGoogle(apiKey, model, prompt);
  else throw new Error("Unknown provider");

  const clean = text.replace(/```json|```/g, "").trim();
  // Forgiving JSON extraction: pull the first {...} object even if the model
  // wraps it in prose.
  const jsonMatch = clean.match(/\{[\s\S]*?\}/);
  const candidate = jsonMatch ? jsonMatch[0] : clean;
  return JSON.parse(candidate);
}

export { PROVIDERS };
