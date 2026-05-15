// Preload bridge — exposes a tiny `window.ostinoteAI` to the renderer so it
// can ask the main process to run prompts through the locally-installed
// `claude` CLI (Claude Code). No API key needed: the CLI uses whatever
// OAuth login is already on this machine.
//
// Scope: dev/testing only. Web builds (Vite, Capacitor) won't have this
// bridge — callers should detect `window.ostinoteAI` and gracefully refuse.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ostinoteAI", {
  // Returns true if `claude` is on PATH and runnable on this machine.
  isAvailable: () => ipcRenderer.invoke("ai:available"),
  // Single-shot completion. Resolves with the text response, or rejects
  // with an Error describing what went wrong (CLI missing, non-zero exit,
  // etc.). Model is one of "haiku" | "sonnet" | "opus" | a full id, or
  // omitted to use the CLI default.
  complete: ({ prompt, model }) => ipcRenderer.invoke("ai:complete", { prompt, model }),
});
