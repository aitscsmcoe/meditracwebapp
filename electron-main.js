// electron-main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

let mainWindow;

const VITE_DEV_SERVER = "http://localhost:5173";
const isDev = !app.isPackaged;

// Polls the Vite dev server until it’s up (dev only)
function waitForVite(url, timeoutMs = 15000, intervalMs = 300) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          res.resume(); // drain
          return resolve();
        }
        res.resume();
        if (Date.now() - start > timeoutMs) reject(new Error("Vite server timeout"));
        else setTimeout(tick, intervalMs);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("Vite server timeout"));
        else setTimeout(tick, intervalMs);
      });
    };
    tick();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // show after load to avoid white flash
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Helpful logging for blank screen debugging
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("✅ Renderer finished loading");
    mainWindow.show();
  });
  mainWindow.webContents.on("did-fail-load", (e, code, desc, url, isMainFrame) => {
    console.error("❌ did-fail-load:", { code, desc, url, isMainFrame });
    mainWindow.loadURL(
      "data:text/html,<h2>Failed to load the app.</h2><p>Check console logs.</p>"
    );
  });

  if (isDev) {
    // DEV: wait for Vite then load URL
    waitForVite(VITE_DEV_SERVER)
      .then(() => {
        console.log("🔌 Vite is up — loading dev server…");
        return mainWindow.loadURL(VITE_DEV_SERVER);
      })
      .then(() => {
        // optional devtools
        mainWindow.webContents.openDevTools({ mode: "detach" });
      })
      .catch((err) => {
        console.error("❌ Could not reach Vite dev server:", err.message);
        mainWindow.loadURL(
          "data:text/html,<h2>Dev server not reachable.</h2><p>Is Vite running on 5173?</p>"
        );
        mainWindow.show();
      });
  } else {
    // PROD: load the built index.html
    const indexPath = path.join(__dirname, "dist", "index.html");
    console.log("📦 Loading production file:", indexPath);
    mainWindow
      .loadFile(indexPath)
      .catch((err) => {
        console.error("❌ Failed to load production build:", err);
        mainWindow.loadURL(
          "data:text/html,<h2>Failed to load production build.</h2><p>Check dist/index.html exists.</p>"
        );
        mainWindow.show();
      });
  }

  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
