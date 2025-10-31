// electron-preload.js

const { contextBridge, ipcRenderer } = require("electron");

// ✅ Secure bridge between Electron (main) and Renderer (React)
contextBridge.exposeInMainWorld("electronAPI", {
  // 🔹 Basic window controls (future use)
  minimize: () => ipcRenderer.send("window-minimize"),
  close: () => ipcRenderer.send("window-close"),

  // 🔹 Printing / PDF export (future)
  print: (content) => ipcRenderer.send("print-content", content),

  // 🔹 Receive notifications or updates from main process
  onAppUpdate: (callback) => ipcRenderer.on("app-update", callback),

  // 🔹 Example secure message
  sendMessage: (msg) => ipcRenderer.send("message-from-ui", msg),

  // 🔹 Request something and get result back (async)
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
