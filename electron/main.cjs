const { app, BrowserWindow, shell, dialog, Notification, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("node:child_process");
const { autoUpdater } = require("electron-updater");

// Window size tuned for the 640px max-width UI + padding + frame
const WIN_WIDTH = 520;
const WIN_HEIGHT = 820;

// Performance: enable GPU rasterization and smooth scrolling
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-smooth-scrolling");

// Auto-updater: download in background, prompt user on completion
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;
autoUpdater.logger.transports = autoUpdater.logger.transports || {};
// Quiet down per-chunk download progress logs in production
if (autoUpdater.logger.transports.file) {
  autoUpdater.logger.transports.file.level = "info";
}

let mainWindow = null;
let updateDialogShown = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    minWidth: 400,
    minHeight: 600,
    maxWidth: 720,
    backgroundColor: "#f5f3ef",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Keep app responsive when not focused
      // Exposes `window.ostinoteAI` for the dev-only Claude (local) provider.
      preload: path.join(__dirname, "preload.cjs"),
    },
    icon: path.join(__dirname, "../build/icon.png"),
    show: false,
  });

  // Load the built app
  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  // Show window once content is painted (avoids white flash)
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in the system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept link clicks that would navigate away
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Auto-updater wiring
//
// Reads from the GitHub Releases configured in package.json `build.publish`.
// On every app start (after a 3s delay), checks for a newer version. If found,
// downloads silently in the background. When the download finishes, prompts
// the user to restart now or apply on next quit.
//
// Errors are logged but never surfaced to the user — failed update checks
// shouldn't disrupt normal app use (e.g. user is offline).
// ---------------------------------------------------------------------------
function setupAutoUpdater() {
  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] Checking for update…");
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`[updater] Update available: v${info.version}`);
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log(`[updater] Up to date (current: v${info.version})`);
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent);
    if (percent % 10 === 0) {
      console.log(`[updater] Downloading update… ${percent}%`);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[updater] Update downloaded: v${info.version}`);

    // Native macOS notification
    if (Notification.isSupported()) {
      const note = new Notification({
        title: "Ostinote update ready",
        body: `Version ${info.version} has been downloaded. Click to install.`,
        silent: false,
      });
      note.on("click", () => promptInstall(info));
      note.show();
    }

    // Modal dialog asking to restart now or later (only show once per session)
    if (!updateDialogShown) {
      updateDialogShown = true;
      promptInstall(info);
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err && err.message ? err.message : err);
    // Silently fail — don't bother user with update errors.
  });
}

function promptInstall(info) {
  if (!mainWindow) return;
  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: "info",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update Ready",
    message: `Ostinote ${info.version} is ready to install.`,
    detail: "Restart now to apply the update, or it will install when you next quit the app.",
  });
  if (choice === 0) {
    autoUpdater.quitAndInstall();
  }
}

// ---------------------------------------------------------------------------
// AI bridge: run prompts through the locally-installed `claude` CLI.
//
// Why: lets us drive every AI feature in the app using your own Claude Code
// OAuth login — no API key, no per-token cost. Strictly a dev-machine
// convenience; the renderer detects `window.ostinoteAI` before allowing the
// "Claude (local)" provider to be picked.
//
// Implementation: spawn `claude --print` and pipe the prompt over stdin so
// we don't trip ARG_MAX on long flashcard-generation prompts that embed
// whole documents.
// ---------------------------------------------------------------------------
function findClaudeBinary() {
  // The CLI is usually on PATH after `npm install -g @anthropic-ai/claude-code`,
  // but Electron apps don't always inherit a login shell's PATH on macOS, so
  // we also try the common install locations explicitly.
  const candidates = [
    "claude", // PATH
    path.join(process.env.HOME || "", ".claude", "local", "claude"),
    path.join(process.env.HOME || "", ".local", "bin", "claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  return candidates;
}

function runClaude(args, { stdinText } = {}) {
  return new Promise((resolve, reject) => {
    const candidates = findClaudeBinary();
    let attempt = 0;

    const tryNext = () => {
      if (attempt >= candidates.length) {
        reject(new Error(
          "Could not find the `claude` CLI. Install it with " +
          "`npm install -g @anthropic-ai/claude-code` and run `claude` once to log in."
        ));
        return;
      }
      const bin = candidates[attempt++];
      const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      let err = "";

      child.on("error", (e) => {
        // ENOENT → try the next candidate; anything else → fail.
        if (e.code === "ENOENT") tryNext();
        else reject(e);
      });
      child.stdout.on("data", (d) => { out += d.toString(); });
      child.stderr.on("data", (d) => { err += d.toString(); });
      child.on("exit", (code) => {
        if (code === 0) resolve(out);
        // CLI writes failure messages like "Not logged in" to stdout
        // (not stderr) before exiting non-zero. Surface whichever stream
        // has content so the renderer's error toast is useful.
        else reject(new Error(`claude exited with code ${code}: ${err.trim() || out.trim() || "(no output)"}`));
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

ipcMain.handle("ai:available", async () => {
  try {
    await runClaude(["--version"]);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("ai:complete", async (_evt, { prompt, model }) => {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt must be a non-empty string");
  }
  const args = ["--print", "--output-format", "text"];
  if (model) args.push("--model", model);
  const text = await runClaude(args, { stdinText: prompt });
  return text.trimEnd();
});

// YouTube transcript + video-info (mirrors /_yt/* Vite plugin endpoints)
ipcMain.handle("yt:transcript", async (_evt, { videoId }) => {
  if (!videoId || typeof videoId !== "string") {
    throw new Error("videoId must be a non-empty string");
  }
  const { YoutubeTranscript } = require("youtube-transcript");
  return YoutubeTranscript.fetchTranscript(videoId);
});

ipcMain.handle("yt:video-info", async (_evt, { videoId }) => {
  if (!videoId || typeof videoId !== "string") {
    throw new Error("videoId must be a non-empty string");
  }
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  );
  if (!res.ok) throw new Error("Could not fetch video info");
  return res.json();
});

// Fetch YouTube's auto-generated caption track in json3 format, which
// includes per-word timing (tOffsetMs on each <seg>). Returns a flat
// array of { text, start } where start is in seconds.
ipcMain.handle("yt:word-timings", async (_evt, { videoId }) => {
  if (!videoId || typeof videoId !== "string") {
    throw new Error("videoId must be a non-empty string");
  }
  return fetchYouTubeWordTimings(videoId);
});

async function fetchYouTubeWordTimings(videoId) {
  return _fetchYouTubeWordTimings(videoId);
}

// Implementation extracted so it can be called from both the Electron
// IPC handler and the Vite dev plugin without duplication. See also
// vite-plugin-claude-bridge.js for an identical copy.
async function _fetchYouTubeWordTimings(videoId) {
  // A real desktop browser UA so YouTube doesn't redirect us to a
  // consent-wall page (which is HTML and trips JSON.parse downstream).
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!pageRes.ok) throw new Error(`Video page returned ${pageRes.status}`);
  const html = await pageRes.text();
  const tracks = _extractCaptionTracks(html);
  if (!tracks.length) throw new Error("No captions on this video");
  const track = tracks.find(t => (t.languageCode || "").startsWith("en"))
             || tracks.find(t => (t.vssId || "").startsWith(".en"))
             || tracks[0];
  const baseUrl = String(track.baseUrl || "").replace(/\\u0026/g, "&");
  if (!baseUrl) throw new Error("Caption track has no URL");
  const capRes = await fetch(`${baseUrl}&fmt=json3`, { headers: { "User-Agent": UA } });
  if (!capRes.ok) throw new Error(`Caption fetch returned ${capRes.status}`);
  const body = await capRes.text();
  if (!body.trim()) throw new Error("Caption response was empty");
  let json3;
  try { json3 = JSON.parse(body); }
  catch { throw new Error("Caption response wasn't valid JSON"); }
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
  if (!words.length) throw new Error("Caption track was empty");
  return words;
}

// Pull "captionTracks":[ ... ] out of a YouTube watch-page HTML safely.
// A naive regex like /"captionTracks":(\[.+?\])/ breaks when any field
// inside the array contains a `]` (e.g. an authored caption track
// name). We walk the string after the marker and balance brackets,
// respecting JSON string escapes, so the extraction is robust.
function _extractCaptionTracks(html) {
  const marker = '"captionTracks":';
  const idx = html.indexOf(marker);
  if (idx === -1) throw new Error("No captionTracks found in video page");
  const arrStart = html.indexOf("[", idx);
  if (arrStart === -1) throw new Error("captionTracks marker not followed by array");
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
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

// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();

  // Only check for updates from packaged builds — running locally with
  // `npm run electron:dev` should not contact GitHub.
  if (app.isPackaged) {
    setupAutoUpdater();
    // Delay the first check so the app finishes loading first.
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("[updater] checkForUpdates failed:", err && err.message ? err.message : err);
      });
    }, 3000);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
