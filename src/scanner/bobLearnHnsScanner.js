const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { fetchBobBridgeCoins, fetchBobBridgePortfolio, fetchBobBridgeShakedex } = require('./bobBridgeClient');

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

function listingPriceHns(listing) {
  return listing.priceHns || listing.startPriceHns || listing.endPriceHns || '';
}

function mergeNamesWithShakedexInventory(names, listings, fulfillments) {
  const rows = [...names];
  const namesByAscii = new Set(names.map((name) => name.name));
  const fulfillmentNames = new Set((fulfillments || []).map((fulfillment) => fulfillment.name).filter(Boolean));

  for (const listing of listings || []) {
    if (!listing.name || namesByAscii.has(listing.name)) continue;
    if (fulfillmentNames.has(listing.name)) continue;

    rows.push({
      name: listing.name,
      unicodeName: listing.unicodeName || listing.name,
      isIdn: !!listing.isIdn,
      status: `shakedex ${listing.stage || 'listing'}`,
      wallet: listing.wallet || 'Bob LearnHNS',
      expires: '',
      renewalHeight: '',
      transferHeight: '',
      hnsPaid: '',
      ownerHash: '',
      ownerIndex: '',
      tags: [
        'shakedex',
        'shakedex-listed',
        'listing-only',
        listing.stage || '',
        listingPriceHns(listing) ? `${listingPriceHns(listing)} HNS` : ''
      ].filter(Boolean),
      source: {
        type: 'bob-learnhns-shakedex-listing'
      }
    });
  }

  return rows;
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
  const bridge = await fetchBobBridgePortfolio().catch((error) => ({
    ok: false,
    status: error.name === 'AbortError' ? 'bridge-timeout' : error.message,
    names: [],
    wallets: []
  }));
  const shakedex = bridge.ok
    ? await fetchBobBridgeShakedex()
    : {
        ok: false,
        status: bridge.status,
        listings: [],
        fulfillments: []
      };
  const coins = bridge.ok
    ? await fetchBobBridgeCoins()
    : {
        ok: false,
        status: bridge.status,
        wallets: []
      };

  const encryptedOrLockedWallets = readableHsdDirs.length > 0 && !bridge.ok
    ? [{
        label: 'Bob LearnHNS wallets',
        status: 'detected-not-enumerated',
        reason: 'Automatic enumeration needs a running Bob LearnHNS build with the HNS Investments read-only bridge.'
      }]
    : [];
  const bridgeNames = bridge.ok ? bridge.names : [];
  const shakedexListings = shakedex.listings || [];
  const shakedexFulfillments = shakedex.fulfillments || [];
  const names = bridge.ok
    ? mergeNamesWithShakedexInventory(bridgeNames, shakedexListings, shakedexFulfillments)
    : [];
  const bridgeNeedsBuild = bridge.status === 'bridge-manifest-not-found';
  const bridgeNeedsBobReady = typeof bridge.status === 'string'
    && bridge.status.includes('HTTP 503');

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
    bridge: {
      ok: !!bridge.ok,
      status: bridge.status,
      manifestPath: bridge.manifestPath || null,
      network: bridge.network || null,
      height: bridge.height || 0,
      walletCount: bridge.wallets ? bridge.wallets.length : 0,
      wallets: bridge.wallets || []
    },
    shakedex: {
      ok: !!shakedex.ok,
      status: shakedex.status,
      listingCount: shakedex.listings ? shakedex.listings.length : 0,
      fulfillmentCount: shakedex.fulfillments ? shakedex.fulfillments.length : 0,
      listings: shakedex.listings || [],
      fulfillments: shakedex.fulfillments || []
    },
    coins: {
      ok: !!coins.ok,
      status: coins.status,
      walletCount: coins.wallets ? coins.wallets.length : 0,
      wallets: coins.wallets || []
    },
    encryptedOrLockedWallets,
    names,
    summary: {
      supportedAppDetected: appSummary.exists,
      hsdDataDirCount: hsdDataDirs.length,
      walletStorageHintCount: hsdDataDirs.reduce(
        (total, dir) => total + (dir.walletStorageHints ? dir.walletStorageHints.length : 0),
        0
      ),
      indexedNameCount: names.length,
      ownedNameCount: bridgeNames.length,
      shakedexListingOnlyCount: names.length - bridgeNames.length,
      mode: bridge.ok ? 'bob-learnhns-read-only-bridge' : 'read-only-filesystem-discovery',
      modeLabel: bridge.ok ? 'Bridge' : 'Discovery',
      nextStep: bridge.ok
        ? 'Bob LearnHNS read-only bridge connected.'
        : bridgeNeedsBuild
          ? 'The running Bob LearnHNS app does not include the HNS Investments bridge yet. Refresh will not populate names until a bridge-enabled Bob build is running.'
          : bridgeNeedsBobReady
            ? 'Bridge found, but Bob LearnHNS wallet service is not ready. Unlock/load Bob, then click Scan again.'
            : appSummary.exists
          ? 'Install or run a Bob LearnHNS build with the HNS Investments read-only bridge to populate portfolio rows.'
          : 'Install or open Bob LearnHNS to begin local discovery.'
    }
  };
}

module.exports = {
  scanBobLearnHns
};
