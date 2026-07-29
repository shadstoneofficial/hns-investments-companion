const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hnsInvestments', {
  scanPortfolio: () => ipcRenderer.invoke('portfolio:scan'),
  loadCommunityRegistry: () => ipcRenderer.invoke('community:registry'),
  loadDomainTags: () => ipcRenderer.invoke('domainTags:load'),
  setDomainTags: (name, tags) => ipcRenderer.invoke('domainTags:set', name, tags),
  openPath: (targetPath) => ipcRenderer.invoke('app:openPath', targetPath),
  openExternal: (targetUrl) => ipcRenderer.invoke('app:openExternal', targetUrl)
});
