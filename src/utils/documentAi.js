// AI helpers that work against a document's text content.
// Pattern: send the full text as context (Gemini 2.5 can handle ~1M tokens).
// All responses are grounded with [p.N] citations the UI parses into clickable
// scroll-to-page links.

import { callAi } from "./aiGrader.js";

const PAGE_CITATION = `Cite specific pages with the format [p.N] every time you reference content from the source. Never invent information that isn't in the document. If the document doesn't address something, say so.`;

const TIME_CITATION = `Cite specific timestamps with the format [t.M:SS] every time you reference content from the transcript. Never invent information that isn't in the transcript. If the transcript doesn't address something, say so.`;

function citationReminder(d) {
  return d?.type === "youtube" ? TIME_CITATION : PAGE_CITATION;
}

function markerNote(d) {
  return d?.type === "youtube"
    ? `(timestamp boundaries shown as "--- M:SS ---" markers)`
    : `(page boundaries shown as "--- Page N ---" markers)`;
}

function citationFormat(d) {
  return d?.type === "youtube" ? "[t.M:SS]" : "[p.N]";
}

const VOICE_REMINDER = `Address the reader directly as "you" — never "the student" or "the user". Be warm, concise, and helpful, like a tutor.`;

// Build the system prompt for a single doc OR a group of docs. When more
// than one doc is provided, the active one is marked [ACTIVE] so the model
// understands which is the user's current focus while still seeing every
// open tab's content as available context.
function docText(d) {
  return d.textContent || d.markdown || "";
}

function buildSystemPrompt(docs, activeDocId) {
  if (docs.length === 1) {
    const d = docs[0];
    const content = docText(d);
    const isYT = d.type === "youtube";
    const sourceLabel = isYT ? "video transcript" : "document";
    return `You are an expert tutor helping the user study a ${sourceLabel} called "${d.title}".

${VOICE_REMINDER}

${citationReminder(d)}

Format your responses in clean Markdown. Use **bold** for key terms, _italic_ for emphasis, and bullet/numbered lists where helpful.

Here is the full ${sourceLabel} content ${markerNote(d)}:

---
${content}
---

Answer the user's questions about this ${sourceLabel}. When you make claims about it, always add ${citationFormat(d)} citations using the ${isYT ? "timestamps" : "page numbers"} you see in the markers above.`;
  }
  const activeDoc = docs.find(d => d.id === activeDocId) || docs[0];
  const sections = docs.map((d, i) => {
    const isActive = d.id === activeDocId;
    const label = d.type === "youtube" ? "Video" : "Document";
    const header = `# ${label} ${i + 1}: "${d.title}"${isActive ? " [ACTIVE]" : ""}`;
    return `${header}\n\n${docText(d)}`;
  }).join("\n\n---\n\n");
  return `You are an expert tutor helping the user study a group of documents and videos. The user has ${docs.length} items open as tabs; the one marked [ACTIVE] is the one they're currently focused on, but you have full access to all of them.

${VOICE_REMINDER}

${citationReminder(activeDoc)} For documents, use [p.N]; for video transcripts, use [t.M:SS]. If the citation comes from a non-active item, prefix with the title in brackets, like: [Title, p.4] or [Title, t.1:23].

When the user says "this document" or "this video," assume they mean the ACTIVE item unless context makes it obvious they mean another. If a question spans multiple items, draw on all of them.

Format your responses in clean Markdown.

---

${sections}

---

Answer the user's questions, citing the relevant source(s) for any factual claims.`;
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
${docText(doc)}

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

// Extract `[p.N]` and `[t.M:SS]` markers from an assistant message.
// Returns { citations: [{ page, label, type }] } where `page` is a page
// number for docs or seconds for video timestamps.
export function parseCitations(text) {
  if (!text) return { citations: [] };
  const citations = [];
  const seen = new Set();

  const pageRe = /\[p\.\s*(\d+)\]/gi;
  let m;
  while ((m = pageRe.exec(text)) !== null) {
    const p = parseInt(m[1], 10);
    const key = `p:${p}`;
    if (!seen.has(key)) { seen.add(key); citations.push({ page: p, label: `p.${p}`, type: "page" }); }
  }

  const timeRe = /\[t\.\s*(\d+):(\d{2})(?::(\d{2}))?\]/gi;
  while ((m = timeRe.exec(text)) !== null) {
    const secs = m[3]
      ? parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
      : parseInt(m[1]) * 60 + parseInt(m[2]);
    const key = `t:${secs}`;
    if (!seen.has(key)) { seen.add(key); citations.push({ page: secs, label: m[0].slice(1, -1), type: "time" }); }
  }

  return { citations: citations.sort((a, b) => a.page - b.page) };
}
