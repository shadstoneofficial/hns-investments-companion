const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const SUPPORTED_APP_NAME = 'Bob LearnHNS';
const UNSUPPORTED_BOB_FOLDERS = [
  'Bob',
  'Bob LearnHNS Test',
  'Bob-backup',
  'Bob-backup2'
];

function appSupportRoot() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }

  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function statSafe(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    return { error };
  }
}

async function readDirSafe(targetPath) {
  try {
    return await fs.readdir(targetPath, { withFileTypes: true });
  } catch (error) {
    return { error };
  }
}

function formatError(error) {
  if (!error) return null;
  return error.code || error.message || String(error);
}

async function getDirectorySummary(targetPath) {
  const stat = await statSafe(targetPath);
  if (stat.error) {
    return {
      path: targetPath,
      exists: false,
      readable: false,
      error: formatError(stat.error)
    };
  }

  const entries = await readDirSafe(targetPath);
  if (entries.error) {
    return {
      path: targetPath,
      exists: true,
      readable: false,
      modifiedAt: stat.mtime.toISOString(),
      error: formatError(entries.error)
    };
  }

  return {
    path: targetPath,
    exists: true,
    readable: true,
    modifiedAt: stat.mtime.toISOString(),
    entryCount: entries.length
  };
}

async function detectUnsupportedFolders(root) {
  const results = [];

  for (const folderName of UNSUPPORTED_BOB_FOLDERS) {
    const folderPath = path.join(root, folderName);
    if (await pathExists(folderPath)) {
      results.push({
        name: folderName,
        path: folderPath,
        status: 'unsupported',
        reason: 'MVP supports Bob LearnHNS only.'
      });
    }
  }

  return results;
}

async function findHsdDataDirs(appPath) {
  const entries = await readDirSafe(appPath);
  if (entries.error) return [];

  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('hsd_data')) continue;

    const targetPath = path.join(appPath, entry.name);
    const summary = await getDirectorySummary(targetPath);
    dirs.push({
      name: entry.name,
      ...summary,
      kind: entry.name === 'hsd_data' ? 'active-candidate' : 'backup-or-migration-candidate'
    });
  }

  return dirs.sort((a, b) => a.name.localeCompare(b.name));
}

async function findWalletStorageHints(hsdDir) {
  const hints = [];
  const candidateNames = ['wallet', 'walletdb', 'wallets'];

  for (const candidateName of candidateNames) {
    const candidatePath = path.join(hsdDir.path, candidateName);
    if (!(await pathExists(candidatePath))) continue;

    hints.push({
      name: candidateName,
      ...await getDirectorySummary(candidatePath),
      status: 'detected',
      access: 'metadata-only'
    });
  }

  return hints;
}

async function scanBobLearnHns() {
  const root = appSupportRoot();
  const appPath = path.join(root, SUPPORTED_APP_NAME);
  const appSummary = await getDirectorySummary(appPath);
  const unsupportedFolders = await detectUnsupportedFolders(root);

  const hsdDataDirs = appSummary.exists && appSummary.readable
    ? await findHsdDataDirs(appPath)
    : [];

  for (const hsdDir of hsdDataDirs) {
    hsdDir.walletStorageHints = hsdDir.readable
      ? await findWalletStorageHints(hsdDir)
      : [];
  }

  const readableHsdDirs = hsdDataDirs.filter((dir) => dir.readable);
  const encryptedOrLockedWallets = readableHsdDirs.length > 0
    ? [{
        label: 'Bob LearnHNS wallets',
        status: 'detected-not-enumerated',
        reason: 'Name enumeration is not enabled until a safe Bob LearnHNS API path is implemented.'
      }]
    : [];

  return {
    scannerVersion: 1,
    scannedAt: new Date().toISOString(),
    platform: process.platform,
    supportedApp: {
      name: SUPPORTED_APP_NAME,
      ...appSummary
    },
    unsupportedFolders,
    hsdDataDirs,
    encryptedOrLockedWallets,
    names: [],
    summary: {
      supportedAppDetected: appSummary.exists,
      hsdDataDirCount: hsdDataDirs.length,
      walletStorageHintCount: hsdDataDirs.reduce(
        (total, dir) => total + (dir.walletStorageHints ? dir.walletStorageHints.length : 0),
        0
      ),
      indexedNameCount: 0,
      mode: 'read-only-filesystem-discovery',
      modeLabel: 'Discovery',
      nextStep: appSummary.exists
        ? 'Bob LearnHNS detected. Connect the read-only Wallet.getNames path to populate portfolio rows.'
        : 'Install or open Bob LearnHNS to begin local discovery.'
    }
  };
}

module.exports = {
  scanBobLearnHns
};
