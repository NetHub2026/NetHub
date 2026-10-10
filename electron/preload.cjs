// Puente seguro entre la interfaz de NetHub y el proceso principal de Electron.
// Se expone en window.nethub y lo consume src/lib/desktop.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nethub", {
  internetProvider: () => ipcRenderer.invoke("nethub:internet-provider"),
  readDevices: () => ipcRenderer.invoke("nethub:read"),
  writeDevices: (json) => ipcRenderer.invoke("nethub:write", json),
  scanNetwork: () => ipcRenderer.invoke("nethub:scan"),
  dbPath: () => ipcRenderer.invoke("nethub:path"),
  ping: (ip) => ipcRenderer.invoke("nethub:ping", ip),
  dnsCheck: (gatewayIp, domain) => ipcRenderer.invoke("nethub:dns-check", gatewayIp, domain),
  scanPorts: (ip, ports, timeout) => ipcRenderer.invoke("nethub:scan-ports", ip, ports, timeout),
  wol: (mac) => ipcRenderer.invoke("nethub:wol", mac),
  traffic: () => ipcRenderer.invoke("nethub:traffic"),
  checkUpdate: () => ipcRenderer.invoke("nethub:check-update"),
  applySettings: (settings) => ipcRenderer.invoke("nethub:apply-settings", settings),
  readSettings: () => ipcRenderer.invoke("nethub:read-settings"),
  writeSettings: (json) => ipcRenderer.invoke("nethub:write-settings", json),
  openDataFolder: () => ipcRenderer.invoke("nethub:open-data-folder"),
  notify: (payload) => ipcRenderer.invoke("nethub:notify", payload),
  listBackups: () => ipcRenderer.invoke("nethub:list-backups"),
  readBackup: id => ipcRenderer.invoke("nethub:read-backup", id),
  restoreBackup: id => ipcRenderer.invoke("nethub:restore-backup", id),
  backupDb: () => ipcRenderer.invoke("nethub:backup-db"),
  openExternal: (url) => ipcRenderer.invoke("nethub:open-external", url),
  // Petición de escaneo desde el menú del área de notificación.
  onScanNow: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("nethub:scan-now", listener);
    return () => ipcRenderer.removeListener("nethub:scan-now", listener);
  },
  installUpdate: (onProgress) => {
    const listener = (_event, payload) => {
      if (typeof onProgress === "function") onProgress(payload);
    };
    ipcRenderer.on("nethub:update-progress", listener);
    return ipcRenderer.invoke("nethub:download-and-install").finally(() => {
      ipcRenderer.removeListener("nethub:update-progress", listener);
    });
  },
});
