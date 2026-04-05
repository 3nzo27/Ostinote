const PROVIDERS = {
  anthropic: {
    name: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
    placeholder: "sk-ant-...",
  },
  openai: {
    name: "OpenAI (ChatGPT)",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1-nano"],
    placeholder: "sk-...",
  },
  google: {
    name: "Google (Gemini)",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.5-flash-preview-05-20", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
    placeholder: "AIza...",
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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
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
  return JSON.parse(clean);
}

export { PROVIDERS };
