// AI helpers that work against a document's converted Markdown.
// Pattern: send the full Markdown as context (Gemini 2.5 can handle ~1M tokens).
// All responses are grounded with [p.N] citations the UI parses into clickable
// scroll-to-page links.

import { callAi } from "./aiGrader.js";

const CITATION_REMINDER = `Cite specific pages with the format [p.N] every time you reference content from the source. Never invent information that isn't in the document. If the document doesn't address something, say so.`;

const VOICE_REMINDER = `Address the reader directly as "you" — never "the student" or "the user". Be warm, concise, and helpful, like a tutor.`;

// Build the system prompt for a single doc OR a group of docs. When more
// than one doc is provided, the active one is marked [ACTIVE] so the model
// understands which is the user's current focus while still seeing every
// open tab's content as available context.
function buildSystemPrompt(docs, activeDocId) {
  if (docs.length === 1) {
    const d = docs[0];
    return `You are an expert tutor helping the user study a document called "${d.title}".

${VOICE_REMINDER}

${CITATION_REMINDER}

Format your responses in clean Markdown. Use **bold** for key terms, _italic_ for emphasis, and bullet/numbered lists where helpful.

Here is the full document content (page boundaries shown as <!-- page N --> markers):

---
${d.markdown}
---

Answer the user's questions about this document. When you make claims about the document, always add [p.N] citations using the page numbers you see in the markers above.`;
  }
  // Multi-doc: combined context. Each doc is its own section so the model
  // can cite which document a fact came from.
  const sections = docs.map((d, i) => {
    const isActive = d.id === activeDocId;
    const header = `# Document ${i + 1}: "${d.title}"${isActive ? " [ACTIVE]" : ""}`;
    return `${header}\n\n${d.markdown}`;
  }).join("\n\n---\n\n");
  return `You are an expert tutor helping the user study a group of documents. The user has ${docs.length} documents open as tabs; the one marked [ACTIVE] is the one they're currently reading, but you have full access to all of them.

${VOICE_REMINDER}

${CITATION_REMINDER} If the citation comes from a document other than the active one, prefix the page tag with the document title in brackets, like: [Document Title, p.4]. If it's from the active doc, [p.4] is fine.

When the user says "this document" or "this page," assume they mean the ACTIVE doc unless the surrounding question makes it obvious they mean another. If a question spans multiple docs, draw on all of them.

Format your responses in clean Markdown.

---

${sections}

---

Answer the user's questions, citing the relevant document(s) for any factual claims.`;
}

// Send a user message + chat history to the AI, get a response back.
// history: [{ role: "user"|"assistant", content: string }, ...]
// `doc` is the active document (legacy callers may pass this alone).
// `docs` is the full set of open tabs — if provided, the AI gets all of
// them as context. When both are passed, `doc` identifies the active one.
export async function chatWithDocument({ aiSettings, doc, docs, history, message }) {
  // claude-local doesn't need a key — it uses the local CLI's OAuth login.
  if (aiSettings?.provider !== "claude-local" && !aiSettings?.apiKey) {
    throw new Error("No API key configured");
  }
  // Prefer the multi-doc path when given a non-empty `docs` array; fall
  // back to the single doc when only `doc` is passed.
  const allDocs = (docs && docs.length > 0) ? docs : (doc ? [doc] : []);
  if (allDocs.length === 0) throw new Error("No document context provided");
  const system = buildSystemPrompt(allDocs, doc?.id || allDocs[0].id);

  // Build a flat prompt the existing callAi() can handle.
  // (We could use provider-native multi-turn APIs later for prompt caching.)
  const transcript = history
    .map(m => (m.role === "user" ? "USER: " : "ASSISTANT: ") + m.content)
    .join("\n\n");

  const prompt = `${system}

CONVERSATION SO FAR:
${transcript || "(this is the first message)"}

USER: ${message}

ASSISTANT:`;

  return callAi(aiSettings, prompt);
}

// Ask the model to suggest a flashcard from a chunk of conversation context.
// Returns { front, back, tags? }
export async function generateFlashcardFromContext({ aiSettings, doc, context }) {
  // claude-local doesn't need a key — it uses the local CLI's OAuth login.
  if (aiSettings?.provider !== "claude-local" && !aiSettings?.apiKey) {
    throw new Error("No API key configured");
  }
  const prompt = `You are creating a high-quality flashcard for spaced repetition study from the following context.

Document: "${doc.title}"

Context (from a chat answer about this document):
${context}

Create ONE flashcard that tests active recall of the most important idea in this context. Rules:
- The front should be a clear, specific question (or cloze prompt).
- The back should be a concise but complete answer.
- Avoid trivially-easy or yes/no questions.
- Include 1-3 short tags categorizing the card (e.g. "definition", "concept", "formula").

Respond ONLY with valid JSON in this exact format:
{"front": "<question>", "back": "<answer>", "tags": ["tag1", "tag2"]}`;

  const text = await callAi(aiSettings, prompt);
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse flashcard JSON");
  return JSON.parse(match[0]);
}

// Generate a batch of flashcards covering the whole document or a section.
// Returns Array<{ front, back, tags?, page? }>
export async function generateFlashcardsFromDocument({ aiSettings, doc, count = 10 }) {
  // claude-local doesn't need a key — it uses the local CLI's OAuth login.
  if (aiSettings?.provider !== "claude-local" && !aiSettings?.apiKey) {
    throw new Error("No API key configured");
  }
  const prompt = `You are creating high-quality flashcards from a document for spaced repetition study.

Document: "${doc.title}"
${doc.markdown}

Generate ${count} flashcards covering the most important concepts. Rules:
- Each flashcard should test active recall — NOT verbatim copy-paste.
- Mix definition / concept / application questions.
- Distribute cards across the document (don't cluster on the first few pages).
- Include the page number where each card's information appears.
- Include 1-2 short tags per card.

Respond ONLY with valid JSON in this exact format:
{"cards": [{"front": "<q>", "back": "<a>", "tags": ["tag1"], "page": <n>}, ...]}`;

  const text = await callAi(aiSettings, prompt);
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse flashcards JSON");
  const parsed = JSON.parse(match[0]);
  return Array.isArray(parsed.cards) ? parsed.cards : [];
}

// Extract `[p.N]` markers from an assistant message and return:
// { stripped: "text without citations", citations: [{ page, label }] }
// (We render citations as separate clickable chips in the UI, so the
// in-line markers are still kept too — the consumer chooses.)
export function parseCitations(text) {
  if (!text) return { citations: [] };
  const re = /\[p\.\s*(\d+)\]/gi;
  const pages = new Set();
  let m;
  while ((m = re.exec(text)) !== null) pages.add(parseInt(m[1], 10));
  return { citations: [...pages].sort((a, b) => a - b).map(p => ({ page: p, label: `p.${p}` })) };
}
