const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hnsInvestments', {
  scanPortfolio: () => ipcRenderer.invoke('portfolio:scan'),
  loadCommunityRegistry: () => ipcRenderer.invoke('community:registry'),
  openPath: (targetPath) => ipcRenderer.invoke('app:openPath', targetPath),
  openExternal: (targetUrl) => ipcRenderer.invoke('app:openExternal', targetUrl)
});
