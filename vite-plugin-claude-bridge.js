// Vite dev-server plugin that exposes the locally-installed `claude` CLI
// to the browser through two endpoints on the same origin as the dev
// server. Lets the Vite-served app (http://localhost:5173) run prompts
// without needing the Electron preload bridge.
//
//   GET  /_ai/available  →  { ok: true|false }
//   POST /_ai/complete   →  { prompt, model? }  body
//                          200 text response
//                          400/500 on error
//
// Dev only — Vite plugins don't run in production builds. The Electron
// path (window.ostinoteAI) is still preferred when present; this is the
// fallback for browser testing.

import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

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

export default function claudeBridge() {
  return {
    name: "ostinote-claude-bridge",
    apply: "serve", // dev only — no-op in `vite build`
    configureServer(server) {
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
