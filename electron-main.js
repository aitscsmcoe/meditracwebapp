const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Create app window
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");  // Dev mode
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));  // Prod mode
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Main Process Event Handling (this should be in the main process only)
ipcMain.on("message-from-ui", (event, msg) => {
  console.log("Message from renderer:", msg);
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
