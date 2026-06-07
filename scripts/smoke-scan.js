#!/usr/bin/env node
const { scanBobLearnHns } = require('../src/scanner/bobLearnHnsScanner');

async function main() {
  const result = await scanBobLearnHns();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
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

