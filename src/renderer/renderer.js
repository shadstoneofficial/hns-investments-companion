const scanButton = document.getElementById('scanButton');
const scanState = document.getElementById('scanState');
const scanDetails = document.getElementById('scanDetails');
const lastScan = document.getElementById('lastScan');
const namesTable = document.getElementById('namesTable');
const nameCount = document.getElementById('nameCount');
const hsdCount = document.getElementById('hsdCount');
const walletHintCount = document.getElementById('walletHintCount');
const scanMode = document.getElementById('scanMode');

function setText(element, value) {
  element.textContent = value == null ? '' : String(value);
}

function renderNames(names, result) {
  namesTable.innerHTML = '';

  if (!names.length) {
    const row = document.createElement('tr');
    const message = result.summary.supportedAppDetected
      ? 'Bob LearnHNS detected. Name enumeration is not connected yet.'
      : 'Bob LearnHNS was not detected on this machine.';
    row.innerHTML = `<td colspan="5" class="empty-cell">${message}</td>`;
    namesTable.appendChild(row);
    return;
  }

  for (const name of names) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${name.name}</td>
      <td>${name.status || 'unknown'}</td>
      <td>${name.wallet || 'unknown'}</td>
      <td>${name.expires || 'unknown'}</td>
      <td>${(name.tags || []).join(', ')}</td>
    `;
    namesTable.appendChild(row);
  }
}

function detailItem(label, value, extraClass = '') {
  const item = document.createElement('div');
  item.className = `detail-item ${extraClass}`.trim();

  const labelEl = document.createElement('span');
  labelEl.textContent = label;

  const valueEl = document.createElement('strong');
  valueEl.textContent = value;

  item.append(labelEl, valueEl);
  return item;
}

function renderScanDetails(result) {
  scanDetails.innerHTML = '';

  const app = result.supportedApp;
  scanDetails.appendChild(detailItem('Supported app', app.exists ? 'Detected' : 'Missing', app.exists ? 'ok' : 'warning'));
  scanDetails.appendChild(detailItem('App path', app.path || 'unknown'));
  scanDetails.appendChild(detailItem('Next step', result.summary.nextStep, result.summary.supportedAppDetected ? 'warning' : 'muted'));

  for (const dir of result.hsdDataDirs) {
    scanDetails.appendChild(detailItem(dir.name, dir.readable ? dir.kind : dir.error, dir.readable ? 'ok' : 'warning'));
  }

  for (const folder of result.unsupportedFolders) {
    scanDetails.appendChild(detailItem(folder.name, 'Unsupported variant', 'muted'));
  }

  for (const wallet of result.encryptedOrLockedWallets) {
    scanDetails.appendChild(detailItem(wallet.label, wallet.status, 'warning'));
  }
}

async function runScan() {
  scanButton.disabled = true;
  setText(scanState, 'Scanning');

  try {
    const result = await window.hnsInvestments.scanPortfolio();
    setText(nameCount, result.summary.indexedNameCount);
    setText(hsdCount, result.summary.hsdDataDirCount);
    setText(walletHintCount, result.summary.walletStorageHintCount);
    setText(scanMode, result.summary.modeLabel || result.summary.mode.replaceAll('-', ' '));
    scanMode.title = result.summary.mode;
    setText(lastScan, new Date(result.scannedAt).toLocaleString());
    setText(scanState, 'Complete');

    renderNames(result.names, result);
    renderScanDetails(result);
  } catch (error) {
    setText(scanState, 'Failed');
    scanDetails.innerHTML = '';
    scanDetails.appendChild(detailItem('Error', error.message || String(error), 'warning'));
  } finally {
    scanButton.disabled = false;
  }
}

scanButton.addEventListener('click', runScan);
runScan();
