const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hnsInvestments', {
  scanPortfolio: () => ipcRenderer.invoke('portfolio:scan'),
  loadCommunityRegistry: () => ipcRenderer.invoke('community:registry'),
  loadDomainTags: () => ipcRenderer.invoke('domainTags:load'),
  setDomainTags: (name, tags) => ipcRenderer.invoke('domainTags:set', name, tags),
  getCloudSyncState: () => ipcRenderer.invoke('cloudSync:state'),
  startCloudPairing: (deviceName) => ipcRenderer.invoke('cloudSync:startPairing', deviceName),
  pollCloudPairing: () => ipcRenderer.invoke('cloudSync:pollPairing'),
  setCloudSyncPreferences: (preferences) => ipcRenderer.invoke('cloudSync:setPreferences', preferences),
  syncCloudNow: () => ipcRenderer.invoke('cloudSync:syncNow'),
  deleteCloudData: () => ipcRenderer.invoke('cloudSync:deleteData'),
  disconnectCloudSync: () => ipcRenderer.invoke('cloudSync:disconnect'),
  openCloudAccount: () => ipcRenderer.invoke('cloudSync:openAccount'),
  openPath: (targetPath) => ipcRenderer.invoke('app:openPath', targetPath),
  openExternal: (targetUrl) => ipcRenderer.invoke('app:openExternal', targetUrl)
});
