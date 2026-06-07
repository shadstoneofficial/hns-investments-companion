const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hnsInvestments', {
  scanPortfolio: () => ipcRenderer.invoke('portfolio:scan'),
  openPath: (targetPath) => ipcRenderer.invoke('app:openPath', targetPath)
});

