// Vite dev-server plugin that exposes the locally-installed `claude` CLI
// and YouTube transcript/info proxies to the browser through endpoints on
// the same origin as the dev server.
//
//   GET  /_ai/available      →  { ok: true|false }
//   POST /_ai/complete       →  { prompt, model? }  body → text
//   POST /_yt/transcript     →  { videoId }  body → [{ text, offset, duration }]
//   GET  /_yt/video-info?v=  →  { title, author_name, thumbnail_url }
//
// Dev only — Vite plugins don't run in production builds. The Electron
// path (window.ostinoteAI / window.ostinoteYT) is preferred when present;
// this is the fallback for browser testing.

import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { YoutubeTranscript } from "youtube-transcript";

function findClaudeBinary() {
  const home = process.env.HOME || os.homedir();
  return [
    "claude",
    path.join(home, ".local", "bin", "claude"),
    path.join(home, ".claude", "local", "claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
}

function runClaude(args, stdinText) {
  return new Promise((resolve, reject) => {
    const candidates = findClaudeBinary();
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        reject(new Error(
          "claude CLI not found. Install with `npm install -g @anthropic-ai/claude-code` and run `claude` once to log in."
        ));
        return;
      }
      const bin = candidates[i++];
      const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.on("error", (e) => {
        if (e.code === "ENOENT") tryNext();
        else reject(e);
      });
      child.stdout.on("data", (d) => { out += d.toString(); });
      child.stderr.on("data", (d) => { err += d.toString(); });
      child.on("exit", (code) => {
        if (code === 0) resolve(out);
        // The CLI writes some failure messages (notably "Not logged in")
        // to stdout, not stderr, then exits 1. Surface whichever stream
        // has content so the user sees a useful message.
        else reject(new Error(`claude exited ${code}: ${(err.trim() || out.trim() || "(no output)")}`));
      });
      if (stdinText != null) {
        child.stdin.write(stdinText);
        child.stdin.end();
      } else {
        child.stdin.end();
      }
    };
    tryNext();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// Fetches YouTube's auto-generated caption track with per-word
// timing. Tries json3 first, falls back to srv3 (the XML format YT's
// own player consumes), then to srv3-by-default (no fmt param). Both
// encode per-word timing; some videos / tracks support one or the
// other depending on age + provenance. Mirrors electron/main.cjs.
async function fetchYouTubeWordTimings(videoId) {
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!pageRes.ok) throw new Error(`Video page returned ${pageRes.status}`);
  const html = await pageRes.text();
  const tracks = extractCaptionTracks(html);
  if (!tracks.length) throw new Error("No captions on this video");
  const track = tracks.find(t => (t.languageCode || "").startsWith("en"))
             || tracks.find(t => (t.vssId || "").startsWith(".en"))
             || tracks[0];
  const rawBase = String(track.baseUrl || "").replace(/\\u0026/g, "&");
  if (!rawBase) throw new Error("Caption track has no URL");

  const captionHeaders = {
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": `https://www.youtube.com/watch?v=${videoId}`,
    "Origin": "https://www.youtube.com",
  };
  const withFmt = (fmt) => {
    const u = new URL(rawBase);
    u.searchParams.set("fmt", fmt);
    return u.toString();
  };

  let words = await tryJson3(withFmt("json3"), captionHeaders);
  if (!words.length) words = await trySrv3(withFmt("srv3"), captionHeaders);
  if (!words.length) words = await trySrv3(rawBase, captionHeaders);
  if (!words.length) throw new Error("Caption track had no usable timing data");
  return words;
}

async function tryJson3(url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const body = await res.text();
    if (!body.trim()) return [];
    const json3 = JSON.parse(body);
    const words = [];
    for (const event of json3.events || []) {
      if (!event.segs) continue;
      const tStart = event.tStartMs || 0;
      for (const seg of event.segs) {
        const text = seg.utf8;
        if (!text || !/\S/.test(text)) continue;
        words.push({ text, start: (tStart + (seg.tOffsetMs || 0)) / 1000 });
      }
    }
    return words;
  } catch { return []; }
}

async function trySrv3(url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const body = await res.text();
    if (!body.trim()) return [];
    return parseSrv3(body);
  } catch { return []; }
}

function parseSrv3(xml) {
  const words = [];
  const paragraphs = xml.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) || [];
  for (const p of paragraphs) {
    const attrs = (p.match(/<p\b([^>]*)>/) || [, ""])[1];
    const pStartMs = parseInt((attrs.match(/\bt="(\d+)"/) || [, "0"])[1], 10) || 0;
    const inner = (p.match(/<p\b[^>]*>([\s\S]*?)<\/p>/) || [, ""])[1];
    const segMatches = [...inner.matchAll(/<s\b([^>]*)>([\s\S]*?)<\/s>/g)];
    if (segMatches.length === 0) {
      const text = decodeXmlEntities(inner).trim();
      if (text) words.push({ text, start: pStartMs / 1000 });
      continue;
    }
    for (const m of segMatches) {
      const segAttrs = m[1] || "";
      const segText = decodeXmlEntities(m[2]);
      if (!segText || !/\S/.test(segText)) continue;
      const offsetMs = parseInt((segAttrs.match(/\bt="(\d+)"/) || [, "0"])[1], 10) || 0;
      words.push({ text: segText, start: (pStartMs + offsetMs) / 1000 });
    }
  }
  return words;
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => { try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ""; } })
    .replace(/&#(\d+);/g, (_, dec) => { try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ""; } });
}

// Pull "captionTracks":[ ... ] out of YT watch-page HTML safely. Walks
// the string and balances brackets so caption-track fields containing
// a `]` (e.g. authored track names) don't truncate the match.
function extractCaptionTracks(html) {
  const marker = '"captionTracks":';
  const idx = html.indexOf(marker);
  if (idx === -1) throw new Error("No captionTracks found in video page");
  const arrStart = html.indexOf("[", idx);
  if (arrStart === -1) throw new Error("captionTracks marker not followed by array");
  let depth = 0, inString = false, escape = false, end = -1;
  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("captionTracks array is unterminated");
  try {
    return JSON.parse(html.substring(arrStart, end + 1));
  } catch (e) {
    throw new Error(`Could not parse captionTracks JSON: ${e.message}`);
  }
}

export default function claudeBridge() {
  return {
    name: "ostinote-claude-bridge",
    apply: "serve", // dev only — no-op in `vite build`
    configureServer(server) {
      // YouTube transcript + video-info proxy
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/_yt/")) return next();

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

        try {
          if (req.url === "/_yt/transcript" && req.method === "POST") {
            const body = await readBody(req);
            const videoId = typeof body.videoId === "string" ? body.videoId : null;
            if (!videoId) { res.statusCode = 400; res.end("videoId is required"); return; }
            const segments = await YoutubeTranscript.fetchTranscript(videoId);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(segments));
            return;
          }
          const infoMatch = req.url.match(/^\/_yt\/video-info\?v=([A-Za-z0-9_-]+)/);
          if (infoMatch) {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${infoMatch[1]}&format=json`;
            const resp = await fetch(oembedUrl);
            if (!resp.ok) { res.statusCode = 404; res.end("Video not found"); return; }
            const data = await resp.json();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ title: data.title, author_name: data.author_name, thumbnail_url: data.thumbnail_url }));
            return;
          }
          if (req.url === "/_yt/word-timings" && req.method === "POST") {
            const body = await readBody(req);
            const videoId = typeof body.videoId === "string" ? body.videoId : null;
            if (!videoId) { res.statusCode = 400; res.end("videoId is required"); return; }
            const words = await fetchYouTubeWordTimings(videoId);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(words));
            return;
          }
          res.statusCode = 404;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e?.message || e));
        }
      });

      // Claude AI bridge
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/_ai/")) return next();

        // CORS for completeness, though same-origin so usually unneeded
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

        try {
          if (req.url === "/_ai/available") {
            // Cheap liveness check — verifies claude is on PATH AND we can
            // execute it. Doesn't check login status (a login error will
            // surface on the first /complete attempt).
            try { await runClaude(["--version"]); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: true })); }
            catch (e) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: false, error: e.message })); }
            return;
          }
          if (req.url === "/_ai/complete" && req.method === "POST") {
            const body = await readBody(req);
            const prompt = typeof body.prompt === "string" ? body.prompt : null;
            const model = body.model;
            if (!prompt) {
              res.statusCode = 400;
              res.end("prompt is required");
              return;
            }
            const args = ["--print", "--output-format", "text"];
            if (model) args.push("--model", model);
            try {
              const text = await runClaude(args, prompt);
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.end(text.replace(/\n+$/, ""));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.end(e.message || "claude bridge error");
            }
            return;
          }
          // Unknown /_ai/* path → 404
          res.statusCode = 404;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e?.message || e));
        }
      });
    },
  };
}
