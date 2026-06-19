const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  addUrls: (text) => ipcRenderer.invoke("add-urls", text),
  getState: () => ipcRenderer.invoke("get-state"),
  retry: (id) => ipcRenderer.invoke("retry", id),
  remove: (id) => ipcRenderer.invoke("remove", id),
  clearDone: () => ipcRenderer.invoke("clear-done"),
  reveal: (f) => ipcRenderer.invoke("reveal", f),
  openFolder: (d) => ipcRenderer.invoke("open-folder", d),
  openUrl: (u) => ipcRenderer.invoke("open-url", u),
  onState: (cb) => ipcRenderer.on("state", (_e, s) => cb(s)),
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (c) => ipcRenderer.invoke("save-config", c),
});
