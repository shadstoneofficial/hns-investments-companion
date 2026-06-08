const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { domainToUnicode } = require('node:url');

const BRIDGE_MANIFEST = 'hns-investments-bridge.json';

function appSupportRoot() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }

  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function manifestPaths() {
  const root = appSupportRoot();
  return [
    path.join(root, 'Bob LearnHNS', BRIDGE_MANIFEST),
    // Source-run Bob uses Electron's default app name unless packaged.
    path.join(root, 'Electron', BRIDGE_MANIFEST)
  ];
}

async function readBridgeManifest() {
  const errors = [];

  for (const filePath of manifestPaths()) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const manifest = JSON.parse(raw);

      if (manifest.app !== 'Bob LearnHNS' || manifest.bridge !== 'hns-investments') {
        throw new Error('Manifest is not for the HNS Investments bridge.');
      }

      if (!manifest.baseUrl || !manifest.token) {
        throw new Error('Manifest is missing bridge connection fields.');
      }

      return {
        ok: true,
        path: filePath,
        manifest
      };
    } catch (error) {
      errors.push({
        path: filePath,
        error: error.code === 'ENOENT' ? 'bridge-manifest-not-found' : error.message
      });
    }
  }

  return {
    ok: false,
    path: errors.map((entry) => entry.path).join(', '),
    error: errors.every((entry) => entry.error === 'bridge-manifest-not-found')
      ? 'bridge-manifest-not-found'
      : errors.map((entry) => `${entry.path}: ${entry.error}`).join('; ')
  };
}

async function fetchJson(url, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || `Bridge returned HTTP ${response.status}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function heightLabel(value) {
  return value ? String(value) : '';
}

function normalizeBridgeNameValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data).toString('utf8');
  }
  return String(value);
}

function unicodeName(asciiName) {
  if (!asciiName.includes('xn--')) return asciiName;
  return domainToUnicode(asciiName) || asciiName;
}

function normalizeBridgeName(name) {
  const asciiName = normalizeBridgeNameValue(name.name);
  return {
    name: asciiName,
    unicodeName: unicodeName(asciiName),
    isIdn: asciiName.includes('xn--'),
    status: name.status || 'owned',
    wallet: name.walletDisplayName || name.walletId || 'Bob LearnHNS',
    expires: heightLabel(name.renewalHeight),
    renewalHeight: name.renewalHeight || '',
    transferHeight: name.transferHeight || '',
    hnsPaid: name.hnsPaid == null ? '' : String(name.hnsPaid),
    ownerHash: name.owner?.hash || '',
    ownerIndex: name.owner?.index == null ? '' : String(name.owner.index),
    tags: [],
    source: {
      type: 'bob-learnhns-bridge'
    }
  };
}

async function fetchBobBridgePortfolio() {
  const manifestResult = await readBridgeManifest();

  if (!manifestResult.ok) {
    return {
      ok: false,
      status: manifestResult.error,
      manifestPath: manifestResult.path,
      names: [],
      wallets: []
    };
  }

  const { manifest } = manifestResult;
  const portfolio = await fetchJson(`${manifest.baseUrl}/portfolio`, manifest.token);

  return {
    ok: !!portfolio.ok,
    status: portfolio.ok ? 'connected' : (portfolio.reason || 'bridge-not-ready'),
    manifestPath: manifestResult.path,
    scannedAt: portfolio.scannedAt,
    network: portfolio.network || null,
    height: portfolio.height || 0,
    wallets: portfolio.wallets || [],
    names: (portfolio.names || []).map(normalizeBridgeName)
  };
}

function normalizeShakedexListing(listing) {
  const asciiName = normalizeBridgeNameValue(listing.name);
  return {
    name: asciiName,
    unicodeName: unicodeName(asciiName),
    isIdn: asciiName.includes('xn--'),
    wallet: listing.walletDisplayName || listing.walletId || 'Bob LearnHNS',
    stage: listing.stage || 'unknown',
    mode: listing.mode || '',
    priceHns: listing.priceHns == null ? '' : String(listing.priceHns),
    startPriceHns: listing.startPriceHns == null ? '' : String(listing.startPriceHns),
    endPriceHns: listing.endPriceHns == null ? '' : String(listing.endPriceHns),
    transferTxHash: listing.transferTxHash || '',
    finalizeTxHash: listing.finalizeTxHash || '',
    proofGenerated: !!listing.proofGenerated,
    submittedPendingListing: !!listing.submittedPendingListing,
    pendingListingError: listing.pendingListingError || ''
  };
}

function normalizeShakedexFulfillment(fulfillment) {
  const asciiName = normalizeBridgeNameValue(fulfillment.name);
  return {
    name: asciiName,
    unicodeName: unicodeName(asciiName),
    isIdn: asciiName.includes('xn--'),
    wallet: fulfillment.walletDisplayName || fulfillment.walletId || 'Bob LearnHNS',
    fulfillmentTxHash: fulfillment.fulfillmentTxHash || '',
    finalizeTxHash: fulfillment.finalizeTxHash || '',
    finalized: !!fulfillment.finalized
  };
}

async function fetchBobBridgeShakedex() {
  const manifestResult = await readBridgeManifest();

  if (!manifestResult.ok) {
    return {
      ok: false,
      status: manifestResult.error,
      manifestPath: manifestResult.path,
      listings: [],
      fulfillments: []
    };
  }

  const { manifest } = manifestResult;

  try {
    const inventory = await fetchJson(`${manifest.baseUrl}/shakedex`, manifest.token);
    return {
      ok: !!inventory.ok,
      status: inventory.ok ? 'connected' : (inventory.reason || 'bridge-not-ready'),
      manifestPath: manifestResult.path,
      scannedAt: inventory.scannedAt,
      network: inventory.network || null,
      height: inventory.height || 0,
      wallets: inventory.wallets || [],
      listings: (inventory.listings || []).map(normalizeShakedexListing),
      fulfillments: (inventory.fulfillments || []).map(normalizeShakedexFulfillment)
    };
  } catch (error) {
    return {
      ok: false,
      status: error.message.includes('Not found') ? 'shakedex-bridge-not-available' : error.message,
      manifestPath: manifestResult.path,
      listings: [],
      fulfillments: []
    };
  }
}

function normalizeCoinWallet(wallet) {
  return {
    wallet: wallet.walletDisplayName || wallet.walletId || 'Bob LearnHNS',
    accountName: wallet.accountName || 'default',
    confirmedHns: wallet.confirmedHns || 0,
    unconfirmedHns: wallet.unconfirmedHns || 0,
    lockedConfirmedHns: wallet.lockedConfirmedHns || 0,
    lockedUnconfirmedHns: wallet.lockedUnconfirmedHns || 0,
    spendableHns: wallet.spendableHns || 0,
    encrypted: !!wallet.walletEncrypted,
    watchOnly: !!wallet.walletWatchOnly
  };
}

async function fetchBobBridgeCoins() {
  const manifestResult = await readBridgeManifest();

  if (!manifestResult.ok) {
    return {
      ok: false,
      status: manifestResult.error,
      manifestPath: manifestResult.path,
      wallets: []
    };
  }

  const { manifest } = manifestResult;

  try {
    const coins = await fetchJson(`${manifest.baseUrl}/coins`, manifest.token);
    return {
      ok: !!coins.ok,
      status: coins.ok ? 'connected' : (coins.reason || 'bridge-not-ready'),
      manifestPath: manifestResult.path,
      scannedAt: coins.scannedAt,
      network: coins.network || null,
      height: coins.height || 0,
      wallets: (coins.wallets || []).map(normalizeCoinWallet)
    };
  } catch (error) {
    return {
      ok: false,
      status: error.message.includes('Not found') ? 'coins-bridge-not-available' : error.message,
      manifestPath: manifestResult.path,
      wallets: []
    };
  }
}

module.exports = {
  fetchBobBridgeCoins,
  fetchBobBridgePortfolio,
  fetchBobBridgeShakedex,
  readBridgeManifest
};
