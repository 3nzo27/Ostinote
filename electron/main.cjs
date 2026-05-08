const { app, BrowserWindow, shell, dialog, Notification } = require("electron");
const path = require("path");
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
