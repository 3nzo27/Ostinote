const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// Window size tuned for the 640px max-width UI + padding + frame
const WIN_WIDTH = 520;
const WIN_HEIGHT = 820;

// Performance: enable GPU rasterization and smooth scrolling
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-smooth-scrolling");

function createWindow() {
  const win = new BrowserWindow({
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
  win.loadFile(path.join(__dirname, "../dist/index.html"));

  // Show window once content is painted (avoids white flash)
  win.once("ready-to-show", () => {
    win.show();
  });

  // Open external links in the system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Intercept link clicks that would navigate away
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) return;
    event.preventDefault();
    shell.openExternal(url);
  });
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
