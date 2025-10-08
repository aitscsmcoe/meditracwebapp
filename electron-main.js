const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
    },
  });

  if (!app.isPackaged) {
    // Development mode → use Vite dev server
    win.loadURL("http://localhost:5173");
  } else {
    // Production mode → use built files from dist/
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  // Optional: open DevTools (useful during testing)
  // win.webContents.openDevTools();
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
