const path = require('node:path');
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const { scanBobLearnHns } = require('../scanner/bobLearnHnsScanner');
const { loadCommunityRegistry } = require('../registry/communityRegistry');
const { applyDomainTagChanges, readDomainTagStore, writeDomainTags } = require('./domainTagStore');
const { createCloudSyncClient } = require('./cloudSyncClient');

let mainWindow;
let cloudSyncClient;
let lastPortfolioResult = null;
const domainTagStorePath = () => path.join(app.getPath('userData'), 'domain-tags.json');
const cloudSyncStatePath = () => path.join(app.getPath('userData'), 'cloud-sync-state.json');

function credentialVault() {
  return {
    get available() {
      return safeStorage.isEncryptionAvailable();
    },
    encrypt(value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Secure operating-system credential storage is unavailable.');
      }
      return safeStorage.encryptString(String(value)).toString('base64');
    },
    decrypt(value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Secure operating-system credential storage is unavailable.');
      }
      return safeStorage.decryptString(Buffer.from(String(value), 'base64'));
    }
  };
}

function cloudMetadataForName(domainName) {
  const name = lastPortfolioResult?.names?.find((item) => item.name === domainName);
  if (!name) return {};
  return {
    unicodeName: name.unicodeName || '',
    isIdn: name.isIdn === true,
    hasEmoji: /\p{Extended_Pictographic}/u.test(name.unicodeName || name.name || ''),
    status: name.status || '',
    renewalHeight: name.renewalHeight || '',
    wallet: name.wallet || ''
  };
}

async function syncCloudNow() {
  const firstPull = await cloudSyncClient.pull();
  let tags = await applyDomainTagChanges(domainTagStorePath(), firstPull.changes);
  const state = await cloudSyncClient.getState();
  if (state.preferences.level === 'full_account' && !lastPortfolioResult) {
    throw new Error('Run a Bob LearnHNS scan before syncing the full account.');
  }
  await cloudSyncClient.queuePortfolio(lastPortfolioResult?.names || [], tags);
  await cloudSyncClient.flush();
  const finalPull = await cloudSyncClient.pull();
  tags = await applyDomainTagChanges(domainTagStorePath(), finalPull.changes);
  return { state: finalPull.state, domainTags: tags };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'HNS Investments',
    icon: path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: '#f6f3ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  cloudSyncClient = createCloudSyncClient({
    statePath: cloudSyncStatePath(),
    endpoint: process.env.HNS_CLOUD_SYNC_URL || '',
    vault: credentialVault()
  });

  ipcMain.handle('portfolio:scan', async () => {
    lastPortfolioResult = await scanBobLearnHns();
    return lastPortfolioResult;
  });
  ipcMain.handle('community:registry', async () => loadCommunityRegistry());
  ipcMain.handle('domainTags:load', async () => readDomainTagStore(domainTagStorePath()));
  ipcMain.handle('domainTags:set', async (_event, name, tags) => {
    const previousStore = await readDomainTagStore(domainTagStorePath());
    const nextStore = await writeDomainTags(domainTagStorePath(), name, tags);
    const previousTags = previousStore.domains[String(name || '').trim().toLowerCase()] || [];
    const nextTags = nextStore.domains[String(name || '').trim().toLowerCase()] || [];
    await cloudSyncClient.queueTagDiff(name, previousTags, nextTags, cloudMetadataForName(name));
    await cloudSyncClient.flush().catch(() => {});
    return nextStore;
  });
  ipcMain.handle('cloudSync:state', async () => cloudSyncClient.getState());
  ipcMain.handle('cloudSync:startPairing', async (_event, deviceName) => {
    const state = await cloudSyncClient.startPairing(deviceName);
    await shell.openExternal(state.pairing.authorizeUrl);
    return state;
  });
  ipcMain.handle('cloudSync:pollPairing', async () => cloudSyncClient.pollPairing());
  ipcMain.handle('cloudSync:setPreferences', async (_event, preferences) => (
    cloudSyncClient.setPreferences(preferences)
  ));
  ipcMain.handle('cloudSync:syncNow', async () => syncCloudNow());
  ipcMain.handle('cloudSync:deleteData', async () => cloudSyncClient.deleteCloudData());
  ipcMain.handle('cloudSync:disconnect', async () => cloudSyncClient.disconnect());
  ipcMain.handle('cloudSync:openAccount', async () => {
    const state = await cloudSyncClient.getState();
    if (!state.accountUrl) return { ok: false, error: 'Cloud Sync is not configured.' };
    await shell.openExternal(state.accountUrl);
    return { ok: true, error: null };
  });
  ipcMain.handle('app:openPath', async (_event, targetPath) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return { ok: false, error: 'Invalid path' };
    }

    const result = await shell.openPath(targetPath);
    return { ok: result === '', error: result || null };
  });
  ipcMain.handle('app:openExternal', async (_event, targetUrl) => {
    if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//.test(targetUrl)) {
      return { ok: false, error: 'Invalid URL' };
    }

    await shell.openExternal(targetUrl);
    return { ok: true, error: null };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
