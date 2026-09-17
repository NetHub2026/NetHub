// Puente seguro entre la interfaz de NetHub y el proceso principal de Electron.
// Se expone en window.nethub y lo consume src/lib/desktop.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nethub", {
  readDevices: () => ipcRenderer.invoke("nethub:read"),
  writeDevices: (json) => ipcRenderer.invoke("nethub:write", json),
  scanNetwork: () => ipcRenderer.invoke("nethub:scan"),
  dbPath: () => ipcRenderer.invoke("nethub:path"),
  ping: (ip) => ipcRenderer.invoke("nethub:ping", ip),
  wol: (mac) => ipcRenderer.invoke("nethub:wol", mac),
  traffic: () => ipcRenderer.invoke("nethub:traffic"),
});
