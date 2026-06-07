const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { scanBobLearnHns } = require('../scanner/bobLearnHnsScanner');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'HNS Investments',
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
  ipcMain.handle('portfolio:scan', async () => scanBobLearnHns());
  ipcMain.handle('app:openPath', async (_event, targetPath) => {
    if (!targetPath || typeof targetPath !== 'string') {
      return { ok: false, error: 'Invalid path' };
    }

    const result = await shell.openPath(targetPath);
    return { ok: result === '', error: result || null };
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

