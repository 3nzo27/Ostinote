// PDF → structured Markdown pipeline.
//
// 1. Extract text from the PDF client-side using pdfjs-dist (page-by-page).
// 2. Send the raw text to the user's configured AI provider with a strict
//    structuring prompt — the model returns clean Markdown with <!-- page N -->
//    anchors between pages.
// 3. Caller stores the resulting markdown in documentStore.
//
// processFile() is the high-level entry point used by the upload UI.
//
// Note: pdfjs-dist needs its worker registered. We point it at a CDN-hosted
// worker file matching the installed library version. (Could be bundled but
// the CDN avoids a Vite worker config change.)

import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import { callAi } from "./aiGrader.js";

// Pin the worker to the version we resolve at import time.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_CHARS = 500_000; // ~125k tokens upper bound for input safety
const MAX_PAGES = 300;     // conversion sanity ceiling

// Extracts page-by-page text. Returns an array of { page, text } objects and
// the total page count.
export async function extractPdfText(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = Math.min(pdf.numPages, MAX_PAGES);
  const pages = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group text items by approximate Y position to reconstruct lines.
    // pdfjs returns items in reading order but doesn't preserve newlines.
    const lines = [];
    let currentLine = [];
    let lastY = null;
    for (const item of content.items) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.length) lines.push(currentLine.join(""));
        currentLine = [];
      }
      currentLine.push(item.str);
      lastY = y;
    }
    if (currentLine.length) lines.push(currentLine.join(""));

    pages.push({ page: i, text: lines.join("\n") });
    onProgress?.({ stage: "extract", page: i, total });
  }

  return { pages, pageCount: total };
}

// Joins extracted pages into a single string with explicit page markers
// the AI uses to anchor its output.
function joinForConversion(pages) {
  return pages
    .map(p => `<PAGE ${p.page}>\n${p.text}`)
    .join("\n\n");
}

const SYSTEM_INSTRUCTION = `You convert raw text extracted from a PDF into clean, study-ready Markdown.

INPUT FORMAT
You will receive text where each page begins with a marker like \`<PAGE 5>\`.

OUTPUT FORMAT
Return clean Markdown. Rules:
- Insert an HTML comment \`<!-- page N -->\` at the START of each page's content (replacing the \`<PAGE N>\` marker). These become navigation anchors.
- Use # / ## / ### for headings based on visual hierarchy in the original.
- Preserve paragraphs — one blank line between them.
- Use - for unordered lists, 1. for ordered lists.
- Use **bold** for clearly emphasized terms; _italic_ for titles or stress emphasis.
- Use \`inline code\` for code, variables, or short literal strings.
- Reconstruct tables using Markdown table syntax when present.
- For math, use \`$...$\` for inline and \`$$...$$\` for block equations.
- Fix hyphenated line-breaks (e.g., "knowl-\\nedge" → "knowledge").
- Remove obvious repeating headers/footers and page numbers — they were a layout artifact, not content.
- Do NOT add information that isn't present in the source text.
- Do NOT add a preamble, table of contents, or summary. Output only the converted content.
- Do NOT wrap your output in code fences.

If a passage looks like garbled OCR text (random characters, broken words), output it as-is with a comment \`<!-- note: this section appears to be poorly scanned -->\` — do not invent corrections.

Begin now.`;

export async function convertToMarkdown(pages, aiSettings, onProgress) {
  const raw = joinForConversion(pages);
  if (raw.length > MAX_CHARS) {
    throw new Error(
      `PDF too large to convert in one pass (${Math.round(raw.length / 1000)}K characters). ` +
      `Chunked conversion isn't supported yet — try a smaller PDF or split it.`
    );
  }
  onProgress?.({ stage: "convert", chars: raw.length });

  const prompt = `${SYSTEM_INSTRUCTION}\n\n--- BEGIN PDF TEXT ---\n${raw}\n--- END PDF TEXT ---`;
  const result = await callAi(aiSettings, prompt);

  // Strip any code-fence wrapper the model might add despite instructions
  return result
    .replace(/^```(?:markdown|md)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
}

// High-level: take a File, return everything documentStore needs to save.
export async function processFile(file, aiSettings, onProgress) {
  onProgress?.({ stage: "start" });

  const { pages, pageCount } = await extractPdfText(file, onProgress);
  if (pageCount === 0) {
    throw new Error("Could not extract any text from this PDF — it may be image-only (scanned).");
  }

  const markdown = await convertToMarkdown(pages, aiSettings, onProgress);

  // Try to infer a title: first H1, else filename without extension
  const firstH1 = markdown.match(/^#\s+(.+)$/m);
  const inferredTitle = firstH1 ? firstH1[1].trim() : file.name.replace(/\.[^.]+$/, "");

  onProgress?.({ stage: "done" });

  return {
    title: inferredTitle,
    markdown,
    pageCount,
    fileSize: file.size,
  };
}
