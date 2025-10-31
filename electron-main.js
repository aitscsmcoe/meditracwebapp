// electron-main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// ✅ Keep a global reference to the window
let mainWindow;

// ✅ Create app window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // prevent flicker until ready
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false, // more secure
      sandbox: false,
    },
  });

  // ✅ Load appropriate content
  if (!app.isPackaged) {
    // Dev mode → use Vite dev server
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // Production → use built files
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  // ✅ Show only when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // ✅ (Optional) Uncomment this line ONLY when debugging dev mode
  // mainWindow.webContents.openDevTools({ mode: "detach" });

  // ✅ Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ✅ Handle events from Renderer
ipcMain.on("message-from-ui", (event, msg) => {
  console.log("📨 Message from renderer:", msg);
});

// ✅ Print handler (for future use)
ipcMain.on("print-content", (event, content) => {
  const printWin = new BrowserWindow({ show: false });
  printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
  printWin.webContents.on("did-finish-load", () => {
    printWin.webContents.print({}, (success) => {
      if (!success) console.error("❌ Print failed");
      printWin.close();
    });
  });
});


// ✅ App Lifecycle Events
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ✅ Close app completely (Windows/Linux)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
