const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const STATE_VERSION = 1;
const MAX_PENDING_OPERATIONS = 5000;
const SYNC_LEVELS = new Set(['none', 'selected_tags', 'full_account']);

function defaultPreferences() {
  return {
    level: 'none',
    selectedTags: [],
    syncWalletLabels: false,
    retainCloudData: false
  };
}

function normalizeEndpoint(value) {
  const text = String(value || '').trim().replace(/\/$/, '');
  if (!text) return '';
  const url = new URL(text);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Cloud Sync requires HTTPS except during local development.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Cloud Sync endpoint must not contain credentials, query parameters, or fragments.');
  }
  return text;
}

function normalizeTag(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function normalizePreferences(value = {}) {
  const level = SYNC_LEVELS.has(value.level) ? value.level : 'none';
  const selectedTags = [];
  const seen = new Set();
  for (const valueTag of Array.isArray(value.selectedTags) ? value.selectedTags : []) {
    const tag = normalizeTag(valueTag);
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      selectedTags.push(tag);
      seen.add(key);
    }
  }
  return {
    level,
    selectedTags: level === 'selected_tags' ? selectedTags : [],
    syncWalletLabels: level === 'full_account' && value.syncWalletLabels === true,
    retainCloudData: level === 'none' && value.retainCloudData === true
  };
}

function normalizeState(value = {}, endpoint = '') {
  return {
    version: STATE_VERSION,
    endpoint,
    deviceId: typeof value.deviceId === 'string' ? value.deviceId : '',
    encryptedDeviceToken: typeof value.encryptedDeviceToken === 'string' ? value.encryptedDeviceToken : '',
    preferences: normalizePreferences(value.preferences),
    cursor: Number.isFinite(Number(value.cursor)) && Number(value.cursor) >= 0 ? Number(value.cursor) : 0,
    pendingOperations: Array.isArray(value.pendingOperations)
      ? value.pendingOperations.slice(-MAX_PENDING_OPERATIONS)
      : [],
    uploadedDomainNames: Array.isArray(value.uploadedDomainNames) ? value.uploadedDomainNames : [],
    uploadedTagAssignments: Array.isArray(value.uploadedTagAssignments) ? value.uploadedTagAssignments : [],
    pairing: value.pairing && typeof value.pairing === 'object' ? {
      id: String(value.pairing.id || ''),
      encryptedPollToken: String(value.pairing.encryptedPollToken || ''),
      authorizeUrl: String(value.pairing.authorizeUrl || ''),
      expiresAt: String(value.pairing.expiresAt || '')
    } : null,
    lastSyncAt: typeof value.lastSyncAt === 'string' ? value.lastSyncAt : '',
    lastError: typeof value.lastError === 'string' ? value.lastError : ''
  };
}

function createCloudSyncClient(options) {
  const statePath = path.resolve(options.statePath);
  const endpoint = normalizeEndpoint(options.endpoint);
  const fetchImpl = options.fetchImpl || fetch;
  const vault = options.vault;
  const now = options.now || (() => new Date());
  let state = normalizeState({}, endpoint);
  let loaded = false;

  if (!vault?.encrypt || !vault?.decrypt) {
    throw new Error('A credential vault adapter is required.');
  }

  async function load() {
    if (loaded) return state;
    try {
      state = normalizeState(JSON.parse(await fs.readFile(statePath, 'utf8')), endpoint);
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      state = normalizeState({}, endpoint);
    }
    loaded = true;
    return state;
  }

  async function save() {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    const temporaryPath = `${statePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
    await fs.rename(temporaryPath, statePath);
  }

  function publicState() {
    return {
      endpointConfigured: !!state.endpoint,
      accountUrl: state.endpoint ? `${state.endpoint}/account` : '',
      credentialStorageAvailable: vault.available === true,
      connected: vault.available === true && !!state.encryptedDeviceToken,
      deviceId: state.deviceId,
      preferences: { ...state.preferences },
      pairing: state.pairing ? {
        id: state.pairing.id,
        authorizeUrl: state.pairing.authorizeUrl,
        expiresAt: state.pairing.expiresAt
      } : null,
      pendingCount: state.pendingOperations.length,
      cursor: state.cursor,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError
    };
  }

  async function request(pathname, requestOptions = {}, authMode = '') {
    if (!state.endpoint) throw new Error('Cloud Sync service is not configured in this build.');
    const headers = { ...(requestOptions.headers || {}) };
    if (authMode === 'device') {
      if (!state.encryptedDeviceToken) throw new Error('Connect a GFAVIP account first.');
      headers.Authorization = `Bearer ${vault.decrypt(state.encryptedDeviceToken)}`;
    } else if (authMode === 'pairing') {
      if (!state.pairing?.encryptedPollToken) throw new Error('No pairing request is active.');
      headers.Authorization = `Pairing ${vault.decrypt(state.pairing.encryptedPollToken)}`;
    }
    const response = await fetchImpl(`${state.endpoint}${pathname}`, {
      ...requestOptions,
      headers
    });
    let body = {};
    try {
      body = await response.json();
    } catch (_error) {
      body = {};
    }
    if (!response.ok) {
      const error = new Error(body.message || `Cloud Sync request failed with ${response.status}.`);
      error.code = body.error || 'cloud_request_failed';
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function getState() {
    await load();
    return publicState();
  }

  async function startPairing(deviceName) {
    await load();
    if (vault.available !== true) {
      throw new Error('Secure operating-system credential storage is unavailable on this computer.');
    }
    const pairing = await request('/api/v1/device-pairings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName })
    });
    const authorizeUrl = new URL(pairing.authorizeUrl);
    if (authorizeUrl.origin !== new URL(state.endpoint).origin) {
      throw new Error('Cloud Sync returned an invalid authorization destination.');
    }
    state.pairing = {
      id: pairing.id,
      encryptedPollToken: vault.encrypt(pairing.pollToken),
      authorizeUrl: authorizeUrl.toString(),
      expiresAt: pairing.expiresAt
    };
    state.lastError = '';
    await save();
    return publicState();
  }

  async function pollPairing() {
    await load();
    if (!state.pairing) throw new Error('No pairing request is active.');
    const result = await request(
      `/api/v1/device-pairings/${encodeURIComponent(state.pairing.id)}`,
      {},
      'pairing'
    );
    if (result.status === 'approved') {
      state.deviceId = result.deviceId;
      state.encryptedDeviceToken = vault.encrypt(result.deviceToken);
      state.pairing = null;
      state.cursor = 0;
      state.preferences = normalizePreferences(await request('/api/v1/sync/preferences', {}, 'device'));
      state.lastError = '';
      await save();
    }
    return { ...publicState(), pairingStatus: result.status };
  }

  async function setPreferences(preferences) {
    await load();
    const normalized = normalizePreferences(preferences);
    state.preferences = normalizePreferences(await request('/api/v1/sync/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    }, 'device'));
    if (state.preferences.level === 'none') {
      state.uploadedDomainNames = [];
      state.uploadedTagAssignments = [];
    }
    state.lastError = '';
    await save();
    return publicState();
  }

  function selectedTagKeys() {
    return new Set(state.preferences.selectedTags.map((tag) => tag.toLowerCase()));
  }

  function operationAllowed(tag) {
    if (state.preferences.level === 'full_account') return true;
    return state.preferences.level === 'selected_tags'
      && selectedTagKeys().has(tag.toLowerCase());
  }

  function queue(operation) {
    state.pendingOperations.push({ id: crypto.randomUUID(), ...operation });
    state.pendingOperations = state.pendingOperations.slice(-MAX_PENDING_OPERATIONS);
  }

  async function queueTagDiff(name, previousTags, nextTags, metadata = {}) {
    await load();
    if (!state.encryptedDeviceToken || state.preferences.level === 'none') return publicState();
    const previous = new Map(previousTags.map((tag) => [tag.toLowerCase(), tag]));
    const next = new Map(nextTags.map((tag) => [tag.toLowerCase(), tag]));
    for (const [key, tag] of previous) {
      if (!next.has(key) && operationAllowed(tag)) {
        queue({ type: 'tag.set', name, tag, present: false });
      }
    }
    for (const [key, tag] of next) {
      if (!previous.has(key) && operationAllowed(tag)) {
        queue({ type: 'tag.set', name, tag, present: true, metadata });
      }
    }
    await save();
    return publicState();
  }

  function safeMetadata(name) {
    return {
      unicodeName: name.unicodeName || '',
      isIdn: name.isIdn === true,
      hasEmoji: name.hasEmoji === true
        || /\p{Extended_Pictographic}/u.test(name.unicodeName || name.name || ''),
      status: name.status || '',
      renewalHeight: name.renewalHeight || '',
      ...(state.preferences.syncWalletLabels ? { walletLabel: name.wallet || '' } : {})
    };
  }

  async function queuePortfolio(names, tagStore) {
    await load();
    if (!state.encryptedDeviceToken || state.preferences.level === 'none') return publicState();
    const tagsByDomain = tagStore?.domains || {};
    const desiredDomains = new Set();
    const desiredAssignments = new Map();
    const previousAssignmentKeys = new Set(state.uploadedTagAssignments.map((assignment) => (
      `${assignment.name.toLowerCase()}\u0000${assignment.tag.toLowerCase()}`
    )));

    if (state.preferences.level === 'full_account') {
      for (const name of names || []) {
        const normalizedName = String(name.name || '').trim().toLowerCase();
        if (!normalizedName) continue;
        desiredDomains.add(normalizedName);
        queue({
          type: 'domain.upsert',
          name: name.name,
          metadata: safeMetadata(name)
        });
      }
      for (const uploadedName of state.uploadedDomainNames) {
        if (!desiredDomains.has(uploadedName)) {
          queue({ type: 'domain.delete', name: uploadedName });
        }
      }
    }

    for (const [name, tags] of Object.entries(tagsByDomain)) {
      for (const tag of tags) {
        if (operationAllowed(tag)) {
          const assignmentKey = `${name.toLowerCase()}\u0000${tag.toLowerCase()}`;
          desiredAssignments.set(assignmentKey, { name, tag });
          if (!previousAssignmentKeys.has(assignmentKey)) {
            const portfolioName = (names || []).find((item) => item.name === name) || {};
            queue({
              type: 'tag.set',
              name,
              tag,
              present: true,
              metadata: safeMetadata(portfolioName)
            });
          }
        }
      }
    }
    for (const assignment of state.uploadedTagAssignments) {
      const assignmentKey = `${assignment.name.toLowerCase()}\u0000${assignment.tag.toLowerCase()}`;
      if (!desiredAssignments.has(assignmentKey)) {
        queue({ type: 'tag.set', name: assignment.name, tag: assignment.tag, present: false });
      }
    }
    state.uploadedDomainNames = [...desiredDomains].sort();
    state.uploadedTagAssignments = [...desiredAssignments.values()];
    await save();
    return publicState();
  }

  async function flush() {
    await load();
    if (!state.encryptedDeviceToken || !state.pendingOperations.length) return publicState();
    try {
      while (state.pendingOperations.length) {
        const batch = state.pendingOperations.slice(0, 500);
        const result = await request('/api/v1/sync/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations: batch })
        }, 'device');
        const accepted = new Set(result.accepted || []);
        state.pendingOperations = state.pendingOperations.filter((operation) => !accepted.has(operation.id));
        await save();
        if (!accepted.size) break;
      }
      state.lastSyncAt = now().toISOString();
      state.lastError = '';
    } catch (error) {
      state.lastError = error.message || String(error);
      await save();
      throw error;
    }
    await save();
    return publicState();
  }

  async function pull() {
    await load();
    if (!state.encryptedDeviceToken) return { state: publicState(), changes: [] };
    try {
      const result = await request(`/api/v1/sync/changes?after=${encodeURIComponent(state.cursor)}`, {}, 'device');
      state.cursor = Number(result.cursor || state.cursor);
      state.preferences = normalizePreferences(result.preferences || state.preferences);
      state.lastSyncAt = now().toISOString();
      state.lastError = '';
      await save();
      return { state: publicState(), changes: result.changes || [] };
    } catch (error) {
      state.lastError = error.message || String(error);
      await save();
      throw error;
    }
  }

  async function disconnect() {
    await load();
    state.deviceId = '';
    state.encryptedDeviceToken = '';
    state.pairing = null;
    state.pendingOperations = [];
    state.uploadedDomainNames = [];
    state.uploadedTagAssignments = [];
    state.cursor = 0;
    state.preferences = defaultPreferences();
    state.lastError = '';
    await save();
    return publicState();
  }

  async function deleteCloudData() {
    await load();
    await request('/api/v1/sync/data', { method: 'DELETE' }, 'device');
    state.preferences = defaultPreferences();
    state.pendingOperations = [];
    state.uploadedDomainNames = [];
    state.uploadedTagAssignments = [];
    state.cursor = 0;
    state.lastSyncAt = now().toISOString();
    state.lastError = '';
    await save();
    return publicState();
  }

  return {
    deleteCloudData,
    disconnect,
    flush,
    getState,
    pollPairing,
    pull,
    queuePortfolio,
    queueTagDiff,
    setPreferences,
    startPairing
  };
}

module.exports = {
  createCloudSyncClient,
  defaultPreferences,
  normalizeEndpoint,
  normalizePreferences,
  normalizeState
};
