const scanButton = document.getElementById('scanButton');
const scanState = document.getElementById('scanState');
const scanDetails = document.getElementById('scanDetails');
const scanCount = document.getElementById('scanCount');
const scanLastRun = document.getElementById('scanLastRun');
const lastScan = document.getElementById('lastScan');
const namesTable = document.getElementById('namesTable');
const nameCount = document.getElementById('nameCount');
const heightCount = document.getElementById('heightCount');
const walletStatLabel = document.getElementById('walletStatLabel');
const walletHintCount = document.getElementById('walletHintCount');
const scanMode = document.getElementById('scanMode');
const summaryStats = document.getElementById('summaryStats');
const communityStats = document.getElementById('communityStats');
const registryAppCount = document.getElementById('registryAppCount');
const registryNewsCount = document.getElementById('registryNewsCount');
const registryFundingCount = document.getElementById('registryFundingCount');
const registryStatus = document.getElementById('registryStatus');
const dashboardDomains = document.getElementById('dashboardDomains');
const dashboardCoins = document.getElementById('dashboardCoins');
const dashboardWallets = document.getElementById('dashboardWallets');
const dashboardAttention = document.getElementById('dashboardAttention');
const dashboardShakedex = document.getElementById('dashboardShakedex');
const dashboardApplications = document.getElementById('dashboardApplications');
const dashboardNews = document.getElementById('dashboardNews');
const dashboardFunding = document.getElementById('dashboardFunding');
const dashboardScan = document.getElementById('dashboardScan');
const dashboardExports = document.getElementById('dashboardExports');
const search = document.getElementById('search');
const walletFilter = document.getElementById('walletFilter');
const lengthFilter = document.getElementById('lengthFilter');
const idnFilter = document.getElementById('idnFilter');
const emojiFilter = document.getElementById('emojiFilter');
const tagFilter = document.getElementById('tagFilter');
const sortButtons = Array.from(document.querySelectorAll('.sort-button'));
const coinSortButtons = Array.from(document.querySelectorAll('.coin-sort-button'));
const navItems = Array.from(document.querySelectorAll('.nav-item'));
const portfolioActions = document.getElementById('portfolioActions');
const registryActions = document.getElementById('registryActions');
const refreshRegistryButton = document.getElementById('refreshRegistryButton');
const registrySourceButton = document.getElementById('registrySourceButton');
const registryHowButton = document.getElementById('registryHowButton');
const viewEyebrow = document.getElementById('viewEyebrow');
const viewTitle = document.getElementById('viewTitle');
const coinsSummary = document.getElementById('coinsSummary');
const coinsTable = document.getElementById('coinsTable');
const walletsSummary = document.getElementById('walletsSummary');
const walletsTable = document.getElementById('walletsTable');
const attentionSummary = document.getElementById('attentionSummary');
const attentionTable = document.getElementById('attentionTable');
const idnSummary = document.getElementById('idnSummary');
const idnTable = document.getElementById('idnTable');
const shakedexSummary = document.getElementById('shakedexSummary');
const shakedexListingsTable = document.getElementById('shakedexListingsTable');
const shakedexFillsSummary = document.getElementById('shakedexFillsSummary');
const shakedexFillsTable = document.getElementById('shakedexFillsTable');
const shakedexTabs = Array.from(document.querySelectorAll('.subtab'));
const shakedexPanels = Array.from(document.querySelectorAll('.shakedex-tab-panel'));
const applicationsSummary = document.getElementById('applicationsSummary');
const applicationsGrid = document.getElementById('applicationsGrid');
const newsSummary = document.getElementById('newsSummary');
const newsGrid = document.getElementById('newsGrid');
const fundingSourcesSummary = document.getElementById('fundingSourcesSummary');
const fundingSourcesGrid = document.getElementById('fundingSourcesGrid');
const fundingProposalsSummary = document.getElementById('fundingProposalsSummary');
const fundingProposalsGrid = document.getElementById('fundingProposalsGrid');
const exportSummary = document.getElementById('exportSummary');
const exportCsvButton = document.getElementById('exportCsvButton');
const exportJsonButton = document.getElementById('exportJsonButton');
const dashboardTiles = Array.from(document.querySelectorAll('.dashboard-tile'));
const views = {
  dashboard: document.getElementById('dashboardView'),
  domains: document.getElementById('domainsView'),
  coins: document.getElementById('coinsView'),
  wallets: document.getElementById('walletsView'),
  attention: document.getElementById('attentionView'),
  shakedex: document.getElementById('shakedexView'),
  applications: document.getElementById('applicationsView'),
  news: document.getElementById('newsView'),
  funding: document.getElementById('fundingView'),
  scan: document.getElementById('scanView'),
  exports: document.getElementById('exportsView')
};
const viewLabels = {
  dashboard: { eyebrow: 'Handshake Hub', title: 'Dashboard' },
  domains: { eyebrow: 'Bob LearnHNS', title: 'Domains' },
  coins: { eyebrow: 'Bob LearnHNS', title: 'Coins' },
  wallets: { eyebrow: 'Domains', title: 'Wallets' },
  attention: { eyebrow: 'Domains', title: 'Attention' },
  shakedex: { eyebrow: 'Bob LearnHNS', title: 'Shakedex' },
  applications: { eyebrow: 'Community Registry', title: 'Applications' },
  news: { eyebrow: 'Community Registry', title: 'News' },
  funding: { eyebrow: 'Community Registry', title: 'Funding' },
  scan: { eyebrow: 'Bob LearnHNS', title: 'Scan' },
  exports: { eyebrow: 'Domains', title: 'Exports' }
};
const publicViews = new Set(['applications', 'news', 'funding']);
const dashboardViews = new Set(['dashboard']);
const REGISTRY_REPO_URL = 'https://github.com/shadstoneofficial/hns-community-registry';
const REGISTRY_DATA_URL = `${REGISTRY_REPO_URL}/tree/main/data`;
const REGISTRY_HOW_TO_SUBMIT_URL = 'https://hnsinvestments.com/sources/';
const registrySourceUrls = {
  applications: `${REGISTRY_REPO_URL}/blob/main/data/apps.json`,
  news: `${REGISTRY_REPO_URL}/blob/main/data/news-sources.json`,
  funding: `${REGISTRY_REPO_URL}/blob/main/data/funding-sources.json`,
  dashboard: REGISTRY_DATA_URL
};
const registrySourceLabels = {
  applications: 'apps.json',
  news: 'news-sources.json',
  funding: 'funding-sources.json',
  dashboard: 'Registry Data'
};

const SETTINGS_KEY = 'hnsInvestments.uiState.v1';

let currentResult = null;
let communityRegistry = null;
let activeView = 'dashboard';
let sortState = {
  key: 'name',
  direction: 'asc'
};
let coinSortState = {
  key: 'spendableHns',
  direction: 'desc'
};
let activeShakedexTab = 'listings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (_error) {
    return {};
  }
}

function saveSettings() {
  const state = {
    activeView,
    sortState,
    coinSortState,
    activeShakedexTab,
    filters: {
      search: search.value,
      wallet: walletFilter.value,
      length: lengthFilter.value,
      idn: idnFilter.value,
      emoji: emojiFilter.value,
      tag: tagFilter.value
    }
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
}

function applySettings() {
  const state = loadSettings();
  if (state.sortState?.key) sortState = state.sortState;
  if (state.coinSortState?.key) coinSortState = state.coinSortState;
  if (state.activeShakedexTab) activeShakedexTab = state.activeShakedexTab;
  if (state.filters) {
    search.value = state.filters.search || '';
    lengthFilter.value = state.filters.length || '';
    idnFilter.value = state.filters.idn || '';
    emojiFilter.value = state.filters.emoji || '';
    tagFilter.value = state.filters.tag || '';
  }
  activeView = views[state.activeView] ? state.activeView : 'dashboard';
}

function setText(element, value) {
  element.textContent = value == null ? '' : String(value);
}

function appendTableRow(tbody, values) {
  const row = document.createElement('tr');

  for (const value of values) {
    const cell = document.createElement('td');
    cell.textContent = value == null ? '' : String(value);
    row.appendChild(cell);
  }

  tbody.appendChild(row);
}

function renderEmptyRow(tbody, colspan, message) {
  tbody.innerHTML = '';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.className = 'empty-cell';
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function showView(viewName) {
  activeView = viewName;

  for (const [name, element] of Object.entries(views)) {
    element.classList.toggle('active', name === viewName);
  }

  for (const item of navItems) {
    item.classList.toggle('active', item.dataset.view === viewName);
  }

  const label = viewLabels[viewName] || viewLabels.dashboard;
  setText(viewEyebrow, label.eyebrow);
  setText(viewTitle, label.title);
  portfolioActions.hidden = viewName !== 'domains';
  registryActions.hidden = !(publicViews.has(viewName) || dashboardViews.has(viewName));
  summaryStats.hidden = publicViews.has(viewName) || dashboardViews.has(viewName);
  communityStats.hidden = !publicViews.has(viewName);
  registrySourceButton.textContent = registrySourceLabels[viewName] || 'Registry Source';
  registrySourceButton.title = registrySourceUrls[viewName] || REGISTRY_DATA_URL;
  saveSettings();
}

function sortValue(name, key) {
  if (key === 'renewalHeight') {
    return Number(name.renewalHeight || 0);
  }

  return String(name[key] || '').toLowerCase();
}

function sortedNames(names) {
  const { key, direction } = sortState;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...names].sort((a, b) => {
    const aValue = sortValue(a, key);
    const bValue = sortValue(b, key);

    if (aValue < bValue) return -1 * multiplier;
    if (aValue > bValue) return 1 * multiplier;
    return String(a.name).localeCompare(String(b.name)) * multiplier;
  });
}

function updateSortButtons() {
  for (const button of sortButtons) {
    const active = button.dataset.sort === sortState.key;
    button.classList.toggle('active', active);
    button.classList.toggle('asc', active && sortState.direction === 'asc');
    button.classList.toggle('desc', active && sortState.direction === 'desc');
    button.setAttribute('aria-sort', active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
  }
}

function updateCoinSortButtons() {
  for (const button of coinSortButtons) {
    const active = button.dataset.coinSort === coinSortState.key;
    button.classList.toggle('active', active);
    button.classList.toggle('asc', active && coinSortState.direction === 'asc');
    button.classList.toggle('desc', active && coinSortState.direction === 'desc');
    button.setAttribute('aria-sort', active ? (coinSortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
  }
}

function showShakedexTab(tabName) {
  activeShakedexTab = tabName;

  for (const tab of shakedexTabs) {
    tab.classList.toggle('active', tab.dataset.shakedexTab === tabName);
  }

  for (const panel of shakedexPanels) {
    panel.classList.toggle('active', panel.dataset.shakedexPanel === tabName);
  }

  saveSettings();
}

function populateWalletFilter(names) {
  const selected = walletFilter.value;
  const wallets = [...new Set(names.map((name) => name.wallet).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  walletFilter.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All wallets';
  walletFilter.appendChild(allOption);

  for (const wallet of wallets) {
    const option = document.createElement('option');
    option.value = wallet;
    option.textContent = wallet;
    walletFilter.appendChild(option);
  }

  walletFilter.value = wallets.includes(selected) ? selected : '';
}

function renderedNameLabel(name) {
  if (!name.isIdn || !name.unicodeName || name.unicodeName === name.name) {
    return '';
  }

  return name.unicodeName;
}

function shakedexListingMap(result) {
  const listings = result.shakedex?.listings || [];
  return new Map(listings.map((listing) => [listing.name, listing]));
}

function shakedexFulfillmentMap(result) {
  const fulfillments = result.shakedex?.fulfillments || [];
  const map = new Map();

  for (const fulfillment of fulfillments) {
    if (!fulfillment.name) continue;
    const existing = map.get(fulfillment.name);
    if (!existing || fulfillment.finalized) {
      map.set(fulfillment.name, fulfillment);
    }
  }

  return map;
}

function shakedexPriceLabel(listing) {
  if (!listing) return '';
  const price = listing.priceHns || listing.startPriceHns || listing.endPriceHns || '';
  return price ? `${price} HNS` : '';
}

function shakedexListingTitle(listing) {
  if (!listing) return '';
  const parts = [
    'Listed on Shakedex',
    listing.stage || '',
    shakedexPriceLabel(listing)
  ].filter(Boolean);
  return parts.join(' · ');
}

function shakedexFulfillmentTitle(fulfillment) {
  if (!fulfillment) return '';
  return fulfillment.finalized
    ? 'Bought via Shakedex · finalized'
    : 'Bought via Shakedex · pending finalize';
}

function hasEmoji(name) {
  const label = renderedNameLabel(name) || name.unicodeName || name.name || '';
  return /\p{Extended_Pictographic}/u.test(label);
}

function domainTags(name, listing, fulfillment) {
  return [
    ...(name.tags || []),
    name.isIdn ? 'idn' : '',
    hasEmoji(name) ? 'emoji' : '',
    listing || fulfillment ? 'shakedex' : '',
    fulfillment ? 'shakedex-bought' : '',
    listing && !fulfillment ? 'shakedex-listed' : '',
    listing && !fulfillment ? shakedexPriceLabel(listing) : ''
  ].filter(Boolean);
}

function visibleDomainTags(name, listing, fulfillment) {
  const tags = [];
  if (fulfillment) {
    tags.push({
      label: 'Bought',
      className: 'shakedex-bought-tag',
      title: shakedexFulfillmentTitle(fulfillment)
    });
  } else if (listing) {
    tags.push({
      label: 'Listed',
      className: 'shakedex-tag',
      title: shakedexListingTitle(listing)
    });
  }

  if (name.shakedexListingOnly) {
    tags.push({
      label: 'Listing only',
      className: 'shakedex-tag',
      title: 'Local Shakedex listing/proof found, but this name was not returned as owned by Bob LearnHNS.'
    });
  }

  if (listing && !fulfillment) {
    const price = shakedexPriceLabel(listing);
    if (price) {
      tags.push({
        label: price,
        className: 'price-tag',
        title: shakedexListingTitle(listing)
      });
    }
  }

  if (name.isIdn) {
    tags.push({
      label: 'IDN',
      className: 'trait-tag',
      title: 'Internationalized domain name'
    });
  }

  if (hasEmoji(name)) {
    tags.push({
      label: 'Emoji',
      className: 'trait-tag',
      title: 'Rendered name contains emoji'
    });
  }

  return tags;
}

function formatHns(value) {
  const number = Number(value || 0);
  return number.toLocaleString(undefined, {
    maximumFractionDigits: 6
  });
}

function nameLength(name) {
  const rendered = renderedNameLabel(name);
  return Array.from(rendered || name.name || '').length;
}

function matchesLengthFilter(name, filter) {
  if (!filter) return true;

  const length = nameLength(name);
  if (filter.endsWith('+')) {
    return length >= Number(filter.slice(0, -1));
  }

  if (filter.includes('-')) {
    const [min, max] = filter.split('-').map(Number);
    return length >= min && length <= max;
  }

  return length === Number(filter);
}

function walletRows(result) {
  const names = result.names || [];
  const bridgeWallets = result.bridge?.wallets || [];
  const rowsByWallet = new Map();

  for (const wallet of bridgeWallets) {
    const label = wallet.displayName || wallet.wid || 'unknown';
    rowsByWallet.set(label, {
      wallet: label,
      count: 0,
      idnCount: 0,
      nearestRenewal: '',
      coinStatus: '',
      status: wallet.encrypted ? 'encrypted' : wallet.watchOnly ? 'watch-only' : 'ready'
    });
  }

  for (const wallet of result.coins?.wallets || []) {
    const label = wallet.wallet || wallet.walletDisplayName || wallet.walletId || 'unknown';
    const row = rowsByWallet.get(label) || {
      wallet: label,
      count: 0,
      idnCount: 0,
      nearestRenewal: '',
      coinStatus: '',
      status: wallet.encrypted ? 'encrypted' : wallet.watchOnly ? 'watch-only' : 'ready'
    };
    const locked = Number(wallet.lockedConfirmedHns || 0) + Number(wallet.lockedUnconfirmedHns || 0);
    const unconfirmedDelta = Number(wallet.unconfirmedHns || 0) - Number(wallet.confirmedHns || 0);
    row.coinStatus = locked > 0 ? 'locked hns' : unconfirmedDelta !== 0 ? 'unconfirmed hns' : '';
    rowsByWallet.set(label, row);
  }

  for (const name of names) {
    const label = name.wallet || 'unknown';
    const row = rowsByWallet.get(label) || {
      wallet: label,
      count: 0,
      idnCount: 0,
      nearestRenewal: '',
      coinStatus: '',
      status: 'ready'
    };

    row.count += 1;
    row.idnCount += name.isIdn ? 1 : 0;

    const renewal = Number(name.renewalHeight || 0);
    if (renewal && (!row.nearestRenewal || renewal < row.nearestRenewal)) {
      row.nearestRenewal = renewal;
    }

    rowsByWallet.set(label, row);
  }

  return [...rowsByWallet.values()].sort((a, b) => b.count - a.count || a.wallet.localeCompare(b.wallet));
}

function renderWallets(result) {
  const rows = walletRows(result);
  setText(walletsSummary, `${rows.length} wallets`);

  if (!rows.length) {
    renderEmptyRow(walletsTable, 5, 'No wallet data available yet.');
    return;
  }

  walletsTable.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.title = `Filter Domains by ${row.wallet}`;
    tr.addEventListener('click', () => {
      walletFilter.value = row.wallet;
      showView('domains');
      if (currentResult) renderNames(currentResult.names, currentResult);
      saveSettings();
    });

    for (const value of [
      row.wallet,
      row.count,
      row.idnCount,
      row.nearestRenewal || '',
      row.coinStatus || row.status
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value == null ? '' : String(value);
      tr.appendChild(cell);
    }

    walletsTable.appendChild(tr);
  }
}

function renderAttention(result) {
  const names = result.names || [];
  const renewalRows = names
    .filter((name) => Number(name.renewalHeight || 0) > 0)
    .sort((a, b) => Number(a.renewalHeight) - Number(b.renewalHeight))
    .slice(0, 80);
  const idnRows = names
    .filter((name) => name.isIdn && renderedNameLabel(name))
    .sort((a, b) => renderedNameLabel(a).localeCompare(renderedNameLabel(b)))
    .slice(0, 120);

  setText(attentionSummary, `${renewalRows.length} shown`);
  setText(idnSummary, `${idnRows.length} shown`);

  if (!renewalRows.length) {
    renderEmptyRow(attentionTable, 4, 'No renewal heights available yet.');
  } else {
    attentionTable.innerHTML = '';
    for (const name of renewalRows) {
      appendTableRow(attentionTable, [
        name.name,
        name.wallet,
        name.renewalHeight,
        name.status
      ]);
    }
  }

  if (!idnRows.length) {
    renderEmptyRow(idnTable, 3, 'No IDNs found yet.');
  } else {
    idnTable.innerHTML = '';
    for (const name of idnRows) {
      appendTableRow(idnTable, [
        name.name,
        renderedNameLabel(name),
        name.wallet
      ]);
    }
  }
}

function renderShakedex(result) {
  const shakedex = result.shakedex || {};
  const listings = shakedex.listings || [];
  const fulfillments = shakedex.fulfillments || [];

  setText(shakedexSummary, shakedex.ok ? `${listings.length} listings` : shakedex.status || 'Bridge needed');
  setText(shakedexFillsSummary, `${fulfillments.length} fills`);

  if (!shakedex.ok) {
    renderEmptyRow(shakedexListingsTable, 4, 'Install or run a Bob LearnHNS build with the Shakedex bridge endpoint.');
  } else if (!listings.length) {
    renderEmptyRow(shakedexListingsTable, 4, 'No local Shakedex listings found.');
  } else {
    shakedexListingsTable.innerHTML = '';
    for (const listing of listings) {
      appendTableRow(shakedexListingsTable, [
        listing.name,
        listing.wallet,
        listing.stage || listing.status || 'unknown',
        listing.priceHns || listing.startPriceHns || listing.endPriceHns || ''
      ]);
    }
  }

  if (!fulfillments.length) {
    renderEmptyRow(shakedexFillsTable, 3, 'No local Shakedex fulfillments found.');
  } else {
    shakedexFillsTable.innerHTML = '';
    for (const fulfillment of fulfillments) {
      appendTableRow(shakedexFillsTable, [
        fulfillment.name,
        fulfillment.wallet,
        fulfillment.finalized ? 'finalized' : 'filled'
      ]);
    }
  }
}

function updatePortfolioDashboard(result) {
  if (!result) return;

  const names = result.names || [];
  const coins = result.coins || {};
  const coinWallets = coins.wallets || [];
  const totalSpendable = coinWallets.reduce((total, wallet) => total + Number(wallet.spendableHns || 0), 0);
  const walletCount = result.bridge?.ok ? result.bridge.walletCount : result.summary?.walletStorageHintCount || 0;
  const shakedex = result.shakedex || {};
  const listings = shakedex.listingCount || shakedex.listings?.length || 0;
  const fills = shakedex.fulfillmentCount || shakedex.fulfillments?.length || 0;
  const renewalCount = names.filter((name) => Number(name.renewalHeight || 0) > 0).length;
  const idnCount = names.filter((name) => name.isIdn).length;

  setText(dashboardDomains, `${names.length} names indexed`);
  setText(dashboardCoins, coins.ok ? `${formatHns(totalSpendable)} HNS spendable` : coins.status || 'Bridge needed');
  setText(dashboardWallets, `${walletCount} wallets`);
  setText(dashboardAttention, `${renewalCount} renewals · ${idnCount} IDNs`);
  setText(dashboardShakedex, shakedex.ok ? `${listings} listings · ${fills} fills` : shakedex.status || 'Bridge needed');
  setText(dashboardScan, result.summary?.modeLabel ? `${result.summary.modeLabel} connected` : 'Ready');
  setText(dashboardExports, `${names.length} names exportable`);
}

function normalizeLabels(labels) {
  return Array.isArray(labels) ? labels : [];
}

function labelText(label) {
  return label
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function linkButtons(entry, options = {}) {
  const links = [
    entry.website ? { label: 'Website', url: entry.website } : null,
    entry.dnsUrl ? { label: 'DNS', url: entry.dnsUrl } : null,
    entry.hnsUrl ? { label: 'HNS', url: entry.hnsUrl } : null,
    entry.repository ? { label: 'Repo', url: entry.repository } : null,
    entry.feedUrl ? { label: 'Feed', url: entry.feedUrl } : null,
    entry.registrySourceUrl ? { label: 'Registry', url: entry.registrySourceUrl } : null,
    entry.sourceUrl ? { label: 'Source', url: entry.sourceUrl } : null,
    entry.projectUrl ? { label: 'Project', url: entry.projectUrl } : null,
    entry.pledgeSourceUrl ? { label: 'Pledges', url: entry.pledgeSourceUrl } : null
  ].filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const link of links) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    unique.push(link);
  }

  const container = document.createElement('div');
  container.className = 'registry-links';
  for (const link of unique.slice(0, options.limit || 4)) {
    const button = document.createElement('button');
    button.className = 'registry-link';
    button.type = 'button';
    button.textContent = link.label;
    button.title = link.url;
    button.addEventListener('click', () => {
      window.hnsInvestments.openExternal(link.url);
    });
    container.appendChild(button);
  }
  return container;
}

function registryBadge(label) {
  const badge = document.createElement('span');
  badge.className = `tag-badge registry-badge ${label === 'flagged' ? 'registry-flagged' : ''} ${label === 'hns-site' ? 'registry-hns' : ''}`.trim();
  badge.textContent = labelText(label);
  return badge;
}

function registryCard(entry, meta = {}) {
  const card = document.createElement('article');
  card.className = 'registry-card';
  if (normalizeLabels(entry.registryLabels).includes('flagged')) {
    card.classList.add('flagged');
  }

  const header = document.createElement('div');
  header.className = 'registry-card-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('h4');
  title.textContent = entry.name || entry.title || 'Untitled';
  const subtitle = document.createElement('p');
  subtitle.textContent = meta.subtitle || entry.category || entry.sourceType || entry.status || '';
  titleWrap.append(title, subtitle);

  const status = document.createElement('span');
  status.className = 'registry-status';
  status.textContent = meta.status || entry.status || (entry.openSource ? 'open source' : 'listed');

  header.append(titleWrap, status);

  const summary = document.createElement('p');
  summary.className = 'registry-summary';
  summary.textContent = entry.summary || 'No summary provided yet.';

  const labels = document.createElement('div');
  labels.className = 'registry-labels';
  const registryLabels = normalizeLabels(entry.registryLabels);
  const derivedLabels = entry.hnsUrl || entry.projectHnsUrl ? ['hns-site'] : [];
  for (const label of [...new Set([...registryLabels, ...derivedLabels])].slice(0, 5)) {
    labels.appendChild(registryBadge(label));
  }

  const facts = document.createElement('div');
  facts.className = 'registry-facts';
  const factValues = [
    entry.sourceName ? `Source: ${entry.sourceName}` : '',
    entry.registrySourceUrl ? 'Registry: hns-community-registry' : '',
    entry.publishedAt ? `Published: ${new Date(entry.publishedAt).toLocaleDateString()}` : '',
    entry.platforms?.length ? `Platforms: ${entry.platforms.join(', ')}` : '',
    entry.tags?.length ? `Tags: ${entry.tags.slice(0, 5).join(', ')}` : '',
    entry.topics?.length ? `Topics: ${entry.topics.slice(0, 5).join(', ')}` : '',
    entry.requestedAmount ? `Requested: ${entry.requestedAmount}` : '',
    entry.pledgedAmount ? `Pledged: ${entry.pledgedAmount}` : '',
    entry.lastVerified ? `Last checked: ${entry.lastVerified}` : ''
  ].filter(Boolean);

  for (const fact of factValues.slice(0, 3)) {
    const item = document.createElement('span');
    item.textContent = fact;
    facts.appendChild(item);
  }

  card.append(header, summary, labels, facts, linkButtons(entry));
  return card;
}

function renderRegistryGrid(grid, entries, emptyMessage, metaForEntry = () => ({})) {
  grid.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = emptyMessage;
    grid.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    grid.appendChild(registryCard(entry, metaForEntry(entry)));
  }
}

function renderCommunityRegistry(registry) {
  const apps = registry?.apps || [];
  const newsSources = registry?.newsSources || [];
  const newsItems = registry?.newsItems || [];
  const fundingSources = registry?.fundingSources || [];
  const fundingProposals = registry?.fundingProposals || [];
  const fundingCount = fundingSources.length + fundingProposals.length;

  setText(registryAppCount, apps.length);
  setText(registryNewsCount, newsSources.length);
  setText(registryFundingCount, fundingCount);
  setText(registryStatus, registry?.ok ? 'Live' : registry?.status || 'Offline');
  registryStatus.title = registry?.source || '';
  setText(dashboardApplications, `${apps.length} apps`);
  setText(dashboardNews, `${newsItems.length} updates · ${newsSources.length} sources`);
  setText(dashboardFunding, `${fundingCount} funding items`);

  setText(applicationsSummary, `${apps.length} apps`);
  setText(newsSummary, newsItems.length ? `${newsItems.length} updates from ${newsSources.length} sources` : `${newsSources.length} sources`);
  setText(fundingSourcesSummary, `${fundingSources.length} sources`);
  setText(fundingProposalsSummary, `${fundingProposals.length} proposals`);

  renderRegistryGrid(applicationsGrid, apps, 'No application entries found in the registry yet.', (entry) => ({
    subtitle: [entry.category, entry.openSource ? 'open source' : 'source unknown'].filter(Boolean).join(' · ')
  }));
  renderRegistryGrid(newsGrid, newsItems.length ? newsItems : newsSources, 'No news sources found in the registry yet.', (entry) => ({
    subtitle: entry.sourceName || [entry.language, entry.topics?.slice(0, 2).join(', ')].filter(Boolean).join(' · '),
    status: entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : 'source'
  }));
  renderRegistryGrid(fundingSourcesGrid, fundingSources, 'No funding sources found in the registry yet.', (entry) => ({
    subtitle: entry.sourceType || 'funding source'
  }));
  renderRegistryGrid(fundingProposalsGrid, fundingProposals, 'Funding proposals will appear here when registry entries are added.', (entry) => ({
    subtitle: [entry.status, entry.currency].filter(Boolean).join(' · ')
  }));
}

async function loadRegistry() {
  refreshRegistryButton.disabled = true;
  setText(refreshRegistryButton, 'Refreshing');
  setText(registryStatus, 'Loading');
  setText(dashboardApplications, 'Loading registry');
  setText(dashboardNews, 'Loading registry');
  setText(dashboardFunding, 'Loading registry');

  try {
    communityRegistry = await window.hnsInvestments.loadCommunityRegistry();
  } catch (error) {
    communityRegistry = {
      ok: false,
      status: 'unavailable',
      apps: [],
      newsSources: [],
      newsItems: [],
      fundingSources: [],
      fundingProposals: [],
      errors: [{ message: error.message || String(error) }]
    };
  }

  renderCommunityRegistry(communityRegistry);
  refreshRegistryButton.disabled = false;
  setText(refreshRegistryButton, 'Refresh Registry');
}

function coinStatus(wallet) {
  const locked = Number(wallet.lockedConfirmedHns || 0) + Number(wallet.lockedUnconfirmedHns || 0);
  const unconfirmedDelta = Number(wallet.unconfirmedHns || 0) - Number(wallet.confirmedHns || 0);
  if (wallet.encrypted) return 'encrypted';
  if (wallet.watchOnly) return 'watch-only';
  if (locked > 0) return 'locked';
  if (unconfirmedDelta !== 0) return 'unconfirmed';
  return 'ready';
}

function coinSortValue(wallet, key) {
  if (key === 'lockedHns') {
    return Number(wallet.lockedConfirmedHns || 0) + Number(wallet.lockedUnconfirmedHns || 0);
  }

  if (['spendableHns', 'confirmedHns', 'unconfirmedHns'].includes(key)) {
    return Number(wallet[key] || 0);
  }

  if (key === 'status') return coinStatus(wallet);
  return String(wallet.wallet || '').toLowerCase();
}

function sortedCoinWallets(wallets) {
  const multiplier = coinSortState.direction === 'asc' ? 1 : -1;

  return [...wallets].sort((a, b) => {
    const aValue = coinSortValue(a, coinSortState.key);
    const bValue = coinSortValue(b, coinSortState.key);
    if (aValue < bValue) return -1 * multiplier;
    if (aValue > bValue) return 1 * multiplier;
    return String(a.wallet || '').localeCompare(String(b.wallet || ''));
  });
}

function renderCoins(result) {
  const coins = result.coins || {};
  const wallets = coins.wallets || [];
  const totalSpendable = wallets.reduce((total, wallet) => total + Number(wallet.spendableHns || 0), 0);

  setText(coinsSummary, coins.ok ? `${formatHns(totalSpendable)} HNS spendable` : coins.status || 'Bridge needed');

  if (!coins.ok) {
    renderEmptyRow(coinsTable, 6, 'Install or run a Bob LearnHNS build with the coin balance bridge endpoint.');
    return;
  }

  if (!wallets.length) {
    renderEmptyRow(coinsTable, 6, 'No wallet balances found.');
    return;
  }

  coinsTable.innerHTML = '';
  for (const wallet of sortedCoinWallets(wallets)) {
    const locked = Number(wallet.lockedConfirmedHns || 0) + Number(wallet.lockedUnconfirmedHns || 0);
    appendTableRow(coinsTable, [
      wallet.wallet,
      `${formatHns(wallet.spendableHns)} HNS`,
      `${formatHns(wallet.confirmedHns)} HNS`,
      `${formatHns(wallet.unconfirmedHns)} HNS`,
      `${formatHns(locked)} HNS`,
      coinStatus(wallet)
    ]);
  }
}

function exportRows(result) {
  const listingsByName = shakedexListingMap(result);
  const fulfillmentsByName = shakedexFulfillmentMap(result);

  return (result.names || []).map((name) => ({
    ...(() => {
      const listing = listingsByName.get(name.name);
      const fulfillment = fulfillmentsByName.get(name.name);
      return {
        shakedexListed: listing && !fulfillment ? 'yes' : '',
        shakedexBought: fulfillment ? 'yes' : '',
        shakedexStage: fulfillment ? 'bought' : listing?.stage || '',
        shakedexPriceHns: listing && !fulfillment ? shakedexPriceLabel(listing).replace(' HNS', '') : ''
      };
    })(),
    name: name.name,
    render: renderedNameLabel(name),
    status: name.status || '',
    wallet: name.wallet || '',
    renewalHeight: name.renewalHeight || '',
    transferHeight: name.transferHeight || '',
    hnsPaid: name.hnsPaid || '',
    ownerHash: name.ownerHash || '',
    ownerIndex: name.ownerIndex || ''
  }));
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderExports(result) {
  const count = result.names ? result.names.length : 0;
  setText(exportSummary, `${count} names`);
  exportCsvButton.disabled = count === 0;
  exportJsonButton.disabled = count === 0;
}

function exportCsv() {
  if (!currentResult) return;

  const rows = exportRows(currentResult);
  const fields = Object.keys(rows[0] || {
    shakedexListed: '',
    shakedexBought: '',
    shakedexStage: '',
    shakedexPriceHns: '',
    name: '',
    render: '',
    status: '',
    wallet: '',
    renewalHeight: '',
    transferHeight: '',
    hnsPaid: '',
    ownerHash: '',
    ownerIndex: ''
  });
  const csv = [
    fields.join(','),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(','))
  ].join('\n');

  downloadFile(`hns-investments-${Date.now()}.csv`, 'text/csv;charset=utf-8', csv);
}

function exportJson() {
  if (!currentResult) return;

  downloadFile(
    `hns-investments-${Date.now()}.json`,
    'application/json;charset=utf-8',
    JSON.stringify({
      scannedAt: currentResult.scannedAt,
      bridge: currentResult.bridge,
      names: exportRows(currentResult)
    }, null, 2)
  );
}

function renderNames(names, result) {
  namesTable.innerHTML = '';
  const listingsByName = shakedexListingMap(result);
  const fulfillmentsByName = shakedexFulfillmentMap(result);
  const query = search.value.trim().toLowerCase();
  const selectedWallet = walletFilter.value;
  const selectedLength = lengthFilter.value;
  const selectedIdn = idnFilter.value;
  const selectedEmoji = emojiFilter.value;
  const selectedTag = tagFilter.value;
  const visibleNames = sortedNames(names.filter((name) => {
    const listing = listingsByName.get(name.name);
    const fulfillment = fulfillmentsByName.get(name.name);
    const rawName = String(name.name || '');
    const wallet = String(name.wallet || '');
    const renderLabel = renderedNameLabel(name).toLowerCase();
    const matchesQuery = !query
      || rawName.toLowerCase().includes(query)
      || renderLabel.includes(query)
      || wallet.toLowerCase().includes(query);
    const matchesWallet = !selectedWallet || wallet === selectedWallet;
    const matchesLength = matchesLengthFilter(name, selectedLength);
    const matchesIdn = !selectedIdn
      || (selectedIdn === 'yes' && name.isIdn)
      || (selectedIdn === 'no' && !name.isIdn);
    const emoji = hasEmoji(name);
    const matchesEmoji = !selectedEmoji
      || (selectedEmoji === 'yes' && emoji)
      || (selectedEmoji === 'no' && !emoji);
    const tags = domainTags(name, listing, fulfillment);
    const matchesTag = !selectedTag || tags.includes(selectedTag);
    return matchesQuery && matchesWallet && matchesLength && matchesIdn && matchesEmoji && matchesTag;
  }));

  if (!visibleNames.length) {
    const row = document.createElement('tr');
    const message = names.length
      ? 'No names match your search.'
      : result.summary.supportedAppDetected
      ? result.summary.nextStep || 'Bob LearnHNS detected. Name enumeration is not connected yet.'
      : 'Bob LearnHNS was not detected on this machine.';
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty-cell';
    cell.textContent = message;
    row.appendChild(cell);
    namesTable.appendChild(row);
    return;
  }

  for (const name of visibleNames) {
    const listing = listingsByName.get(name.name);
    const fulfillment = fulfillmentsByName.get(name.name);
    const row = document.createElement('tr');
    row.classList.toggle('shakedex-listed-row', !!listing && !fulfillment);
    row.classList.toggle('shakedex-bought-row', !!fulfillment);
    row.title = fulfillment ? shakedexFulfillmentTitle(fulfillment) : shakedexListingTitle(listing);

    const tags = domainTags(name, listing, fulfillment);
    const displayTags = visibleDomainTags(name, listing, fulfillment);

    const nameCell = document.createElement('td');
    nameCell.textContent = name.name;

    const renderCell = document.createElement('td');
    renderCell.textContent = renderedNameLabel(name);

    const statusCell = document.createElement('td');
    statusCell.textContent = name.status || 'unknown';
    if (fulfillment) {
      const badge = document.createElement('span');
      badge.className = 'status-badge shakedex-bought-badge';
      badge.textContent = 'Bought';
      badge.title = shakedexFulfillmentTitle(fulfillment);
      statusCell.appendChild(badge);
    } else if (listing) {
      const badge = document.createElement('span');
      badge.className = 'status-badge shakedex-badge';
      badge.textContent = 'Listed';
      badge.title = shakedexListingTitle(listing);
      statusCell.appendChild(badge);
    }

    const walletCell = document.createElement('td');
    walletCell.textContent = name.wallet || 'unknown';

    const expiresCell = document.createElement('td');
    expiresCell.textContent = name.expires || 'unknown';

    const tagsCell = document.createElement('td');
    tagsCell.className = 'tags-cell';
    tagsCell.title = displayTags.map((tag) => tag.title || tag.label).join(' · ');
    for (const tag of displayTags.slice(0, 3)) {
      const badge = document.createElement('span');
      badge.className = `tag-badge ${tag.className || ''}`.trim();
      badge.textContent = tag.label;
      badge.title = tag.title || tag.label;
      tagsCell.appendChild(badge);
    }
    if (displayTags.length > 3) {
      const moreBadge = document.createElement('span');
      moreBadge.className = 'tag-badge more-tag';
      moreBadge.textContent = `+${displayTags.length - 3}`;
      moreBadge.title = displayTags.slice(3).map((tag) => tag.title || tag.label).join(' · ');
      tagsCell.appendChild(moreBadge);
    }

    row.append(nameCell, renderCell, statusCell, walletCell, expiresCell, tagsCell);

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
  if (result.bridge) {
    scanDetails.appendChild(detailItem('Bob bridge', result.bridge.status || 'unknown', result.bridge.ok ? 'ok' : 'warning'));
    if (result.bridge.network) {
      scanDetails.appendChild(detailItem('Bridge network', `${result.bridge.network} at ${result.bridge.height || 'unknown height'}`, 'ok'));
    }
  }
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
    currentResult = result;
    const names = result.names;

    setText(nameCount, names.length);
    setText(heightCount, result.bridge?.height || 0);
    setText(walletStatLabel, result.bridge?.ok ? 'Wallets' : 'Wallet hints');
    setText(walletHintCount, result.bridge?.ok ? result.bridge.walletCount : result.summary.walletStorageHintCount);
    setText(scanMode, result.summary.modeLabel || result.summary.mode.replaceAll('-', ' '));
    scanMode.title = result.summary.mode;
    setText(lastScan, new Date(result.scannedAt).toLocaleString());
    setText(scanLastRun, new Date(result.scannedAt).toLocaleString());
    setText(scanCount, `${names.length} names`);
    setText(scanState, 'Complete');

    populateWalletFilter(names);
    const savedWallet = loadSettings().filters?.wallet || '';
    if (savedWallet && Array.from(walletFilter.options).some((option) => option.value === savedWallet)) {
      walletFilter.value = savedWallet;
    }
    updateSortButtons();
    updateCoinSortButtons();
    showShakedexTab(activeShakedexTab);
    renderNames(names, result);
    renderCoins(result);
    renderWallets(result);
    renderAttention(result);
    renderShakedex(result);
    renderExports(result);
    renderScanDetails(result);
    updatePortfolioDashboard(result);
  } catch (error) {
    setText(scanState, 'Failed');
    setText(dashboardScan, 'Scan failed');
    scanDetails.innerHTML = '';
    scanDetails.appendChild(detailItem('Error', error.message || String(error), 'warning'));
  } finally {
    scanButton.disabled = false;
  }
}

scanButton.addEventListener('click', runScan);
for (const item of navItems) {
  item.addEventListener('click', () => {
    showView(item.dataset.view || 'domains');
  });
}
for (const tile of dashboardTiles) {
  tile.addEventListener('click', () => {
    showView(tile.dataset.targetView || 'dashboard');
  });
}
search.addEventListener('input', () => {
  if (!currentResult) return;
  saveSettings();
  renderNames(currentResult.names, currentResult);
});
walletFilter.addEventListener('change', () => {
  if (!currentResult) return;
  saveSettings();
  renderNames(currentResult.names, currentResult);
});
lengthFilter.addEventListener('change', () => {
  if (!currentResult) return;
  saveSettings();
  renderNames(currentResult.names, currentResult);
});
idnFilter.addEventListener('change', () => {
  if (!currentResult) return;
  saveSettings();
  renderNames(currentResult.names, currentResult);
});
emojiFilter.addEventListener('change', () => {
  if (!currentResult) return;
  saveSettings();
  renderNames(currentResult.names, currentResult);
});
tagFilter.addEventListener('change', () => {
  if (!currentResult) return;
  saveSettings();
  renderNames(currentResult.names, currentResult);
});
for (const button of sortButtons) {
  button.addEventListener('click', () => {
    const key = button.dataset.sort;
    if (sortState.key === key) {
      sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = {
        key,
        direction: key === 'renewalHeight' ? 'desc' : 'asc'
      };
    }

    updateSortButtons();
    saveSettings();
    if (currentResult) renderNames(currentResult.names, currentResult);
  });
}
for (const button of coinSortButtons) {
  button.addEventListener('click', () => {
    const key = button.dataset.coinSort;
    if (coinSortState.key === key) {
      coinSortState.direction = coinSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      coinSortState = {
        key,
        direction: ['wallet', 'status'].includes(key) ? 'asc' : 'desc'
      };
    }

    updateCoinSortButtons();
    saveSettings();
    if (currentResult) renderCoins(currentResult);
  });
}
for (const tab of shakedexTabs) {
  tab.addEventListener('click', () => {
    showShakedexTab(tab.dataset.shakedexTab || 'listings');
  });
}
exportCsvButton.addEventListener('click', exportCsv);
exportJsonButton.addEventListener('click', exportJson);
refreshRegistryButton.addEventListener('click', loadRegistry);
registrySourceButton.addEventListener('click', () => {
  const url = registrySourceUrls[activeView] || communityRegistry?.dataUrl || REGISTRY_DATA_URL;
  window.hnsInvestments.openExternal(url);
});
registryHowButton.addEventListener('click', () => {
  window.hnsInvestments.openExternal(REGISTRY_HOW_TO_SUBMIT_URL);
});
applySettings();
updateSortButtons();
updateCoinSortButtons();
showShakedexTab(activeShakedexTab);
showView(activeView);
loadRegistry();
runScan();
