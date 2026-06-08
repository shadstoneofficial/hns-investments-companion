#!/usr/bin/env node
const { scanBobLearnHns } = require('../src/scanner/bobLearnHnsScanner');

async function main() {
  const result = await scanBobLearnHns();

  if (process.argv.includes('--full-json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const safeSummary = {
    scannedAt: result.scannedAt,
    supportedApp: {
      name: result.supportedApp.name,
      exists: result.supportedApp.exists,
      readable: result.supportedApp.readable,
      entryCount: result.supportedApp.entryCount || 0
    },
    bridge: {
      ok: result.bridge.ok,
      status: result.bridge.status,
      network: result.bridge.network,
      height: result.bridge.height,
      walletCount: result.bridge.walletCount
    },
    shakedex: {
      ok: result.shakedex.ok,
      status: result.shakedex.status,
      listingCount: result.shakedex.listingCount,
      fulfillmentCount: result.shakedex.fulfillmentCount
    },
    coins: {
      ok: result.coins.ok,
      status: result.coins.status,
      walletCount: result.coins.walletCount
    },
    summary: result.summary,
    hsdDataDirCount: result.summary.hsdDataDirCount,
    walletStorageHintCount: result.summary.walletStorageHintCount,
    unsupportedFolderCount: result.unsupportedFolders.length
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(safeSummary, null, 2));
    return;
  }

  console.log('HNS Investments read-only scan');
  console.log(`Scanned: ${result.scannedAt}`);
  console.log(`Bob LearnHNS detected: ${result.summary.supportedAppDetected}`);
  console.log(`HSD data folders: ${result.summary.hsdDataDirCount}`);
  console.log(`Wallet storage hints: ${result.summary.walletStorageHintCount}`);
  console.log(`Indexed names: ${result.summary.indexedNameCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
