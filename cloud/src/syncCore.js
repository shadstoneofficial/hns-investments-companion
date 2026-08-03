const crypto = require('node:crypto');

const SYNC_LEVELS = Object.freeze({
  NONE: 'none',
  SELECTED_TAGS: 'selected_tags',
  FULL_ACCOUNT: 'full_account'
});

const ALLOWED_DOMAIN_METADATA = new Set([
  'unicodeName',
  'isIdn',
  'hasEmoji',
  'status',
  'renewalHeight'
]);

class SyncError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = status;
  }
}

function normalizeName(value) {
  const name = String(value || '').trim().toLowerCase();
  if (!name || name.length > 255) {
    throw new SyncError('invalid_domain', 'A valid domain name is required.');
  }
  return name;
}

function normalizeTag(value) {
  const displayLabel = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!displayLabel) {
    throw new SyncError('invalid_tag', 'A valid tag is required.');
  }
  return { key: displayLabel.toLowerCase(), displayLabel };
}

function normalizePreferences(value = {}) {
  const level = Object.values(SYNC_LEVELS).includes(value.level)
    ? value.level
    : SYNC_LEVELS.NONE;
  const selectedTags = [];
  const seen = new Set();

  for (const valueTag of Array.isArray(value.selectedTags) ? value.selectedTags : []) {
    const tag = normalizeTag(valueTag);
    if (!seen.has(tag.key)) {
      selectedTags.push(tag.displayLabel);
      seen.add(tag.key);
    }
  }

  return {
    level,
    selectedTags: level === SYNC_LEVELS.SELECTED_TAGS ? selectedTags : [],
    syncWalletLabels: level === SYNC_LEVELS.FULL_ACCOUNT && value.syncWalletLabels === true,
    retainCloudData: level === SYNC_LEVELS.NONE && value.retainCloudData === true
  };
}

function sanitizeMetadata(value, preferences) {
  const source = value && typeof value === 'object' ? value : {};
  const metadata = {};
  for (const key of ALLOWED_DOMAIN_METADATA) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      metadata[key] = source[key];
    }
  }
  if (preferences.syncWalletLabels && source.walletLabel) {
    metadata.walletLabel = String(source.walletLabel).trim().slice(0, 120);
  }
  return metadata;
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function publicDevice(device) {
  return {
    id: device.id,
    displayName: device.displayName,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt
  };
}

class MemorySyncStore {
  constructor(options = {}) {
    this.now = options.now || (() => new Date());
    this.pairingLifetimeMs = options.pairingLifetimeMs || 10 * 60 * 1000;
    this.users = new Map();
    this.devices = new Map();
    this.devicesByTokenHash = new Map();
    this.pairings = new Map();
  }

  ensureUser(userId) {
    const id = String(userId || '').trim();
    if (!id) throw new SyncError('invalid_user', 'An authenticated user is required.', 401);
    if (!this.users.has(id)) {
      this.users.set(id, {
        preferences: normalizePreferences(),
        domains: new Map(),
        tags: new Map(),
        events: [],
        operationIds: new Set(),
        nextRevision: 1
      });
    }
    return this.users.get(id);
  }

  createPairing({ deviceName }) {
    const displayName = String(deviceName || '').trim().slice(0, 120);
    if (!displayName) {
      throw new SyncError('invalid_device_name', 'A device name is required.');
    }

    const id = crypto.randomUUID();
    const pollToken = randomSecret();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + this.pairingLifetimeMs);
    this.pairings.set(id, {
      id,
      displayName,
      pollTokenHash: hashSecret(pollToken),
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      approvedBy: null,
      claimedAt: null,
      deviceToken: null
    });

    return {
      id,
      pollToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  pairing(pairingId) {
    const pairing = this.pairings.get(pairingId);
    if (!pairing) throw new SyncError('pairing_not_found', 'Pairing request not found.', 404);
    if (new Date(pairing.expiresAt).getTime() <= this.now().getTime()) {
      throw new SyncError('pairing_expired', 'Pairing request has expired.', 410);
    }
    return pairing;
  }

  approvePairing({ pairingId, authenticatedUserId }) {
    const pairing = this.pairing(pairingId);
    if (pairing.approvedBy) {
      throw new SyncError('pairing_already_approved', 'Pairing request was already approved.', 409);
    }

    this.ensureUser(authenticatedUserId);
    const deviceToken = randomSecret();
    const now = this.now().toISOString();
    const device = {
      id: crypto.randomUUID(),
      userId: String(authenticatedUserId),
      displayName: pairing.displayName,
      tokenHash: hashSecret(deviceToken),
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null
    };
    this.devices.set(device.id, device);
    this.devicesByTokenHash.set(device.tokenHash, device.id);
    pairing.approvedBy = device.userId;
    pairing.deviceToken = deviceToken;
    pairing.deviceId = device.id;
    return publicDevice(device);
  }

  claimPairing({ pairingId, pollToken }) {
    const pairing = this.pairing(pairingId);
    if (hashSecret(String(pollToken || '')) !== pairing.pollTokenHash) {
      throw new SyncError('invalid_pairing_secret', 'Pairing secret is invalid.', 401);
    }
    if (!pairing.approvedBy) return { status: 'pending' };
    if (pairing.claimedAt || !pairing.deviceToken) return { status: 'claimed' };

    const deviceToken = pairing.deviceToken;
    pairing.deviceToken = null;
    pairing.claimedAt = this.now().toISOString();
    return {
      status: 'approved',
      deviceId: pairing.deviceId,
      deviceToken
    };
  }

  authenticateDevice(deviceToken) {
    const tokenHash = hashSecret(String(deviceToken || ''));
    const deviceId = this.devicesByTokenHash.get(tokenHash);
    const device = deviceId ? this.devices.get(deviceId) : null;
    if (!device || device.revokedAt) {
      throw new SyncError('invalid_device', 'Device credential is invalid or revoked.', 401);
    }
    device.lastSeenAt = this.now().toISOString();
    return device;
  }

  getPreferencesForUser(authenticatedUserId) {
    return { ...this.ensureUser(authenticatedUserId).preferences };
  }

  getPreferences(deviceToken) {
    const device = this.authenticateDevice(deviceToken);
    return this.getPreferencesForUser(device.userId);
  }

  setPreferencesForUser(authenticatedUserId, value) {
    const user = this.ensureUser(authenticatedUserId);
    const preferences = normalizePreferences(value);
    user.preferences = preferences;
    this.reconcileScope(user, preferences);
    return { ...preferences };
  }

  setPreferences(deviceToken, value) {
    const device = this.authenticateDevice(deviceToken);
    return this.setPreferencesForUser(device.userId, value);
  }

  appendEvent(user, event) {
    const revision = user.nextRevision++;
    const stored = {
      ...event,
      revision,
      updatedAt: this.now().toISOString()
    };
    user.events.push(stored);
    return stored;
  }

  setDomain(user, name, present, metadata = {}) {
    const existing = user.domains.get(name);
    if (existing?.present === present
      && JSON.stringify(existing.metadata || {}) === JSON.stringify(metadata || {})) {
      return existing;
    }
    const event = this.appendEvent(user, {
      type: 'domain',
      name,
      present,
      metadata: present ? metadata : {}
    });
    user.domains.set(name, event);
    return event;
  }

  setTag(user, name, tag, present, options = {}) {
    const key = `${name}\u0000${tag.key}`;
    const existing = user.tags.get(key);
    if (existing?.present === present && existing?.displayLabel === tag.displayLabel) {
      return existing;
    }
    const event = this.appendEvent(user, {
      type: 'tag',
      name,
      tag: tag.key,
      displayLabel: tag.displayLabel,
      present,
      propagateToLocal: options.propagateToLocal !== false
    });
    user.tags.set(key, event);
    return event;
  }

  presentTagsForDomain(user, name, allowedKeys = null) {
    return [...user.tags.values()].filter((tag) => (
      tag.name === name
      && tag.present
      && (!allowedKeys || allowedKeys.has(tag.tag))
    ));
  }

  reconcileScope(user, preferences) {
    if (preferences.level === SYNC_LEVELS.NONE) {
      if (preferences.retainCloudData) return;
      for (const tag of [...user.tags.values()]) {
        if (tag.present) this.setTag(user, tag.name, normalizeTag(tag.displayLabel), false, {
          propagateToLocal: false
        });
      }
      for (const domain of [...user.domains.values()]) {
        if (domain.present) this.setDomain(user, domain.name, false);
      }
      return;
    }

    if (preferences.level !== SYNC_LEVELS.SELECTED_TAGS) return;
    const allowedKeys = new Set(preferences.selectedTags.map((tag) => normalizeTag(tag).key));
    for (const tag of [...user.tags.values()]) {
      if (tag.present && !allowedKeys.has(tag.tag)) {
        this.setTag(user, tag.name, normalizeTag(tag.displayLabel), false, {
          propagateToLocal: false
        });
      }
    }
    for (const domain of [...user.domains.values()]) {
      const keep = this.presentTagsForDomain(user, domain.name, allowedKeys).length > 0;
      if (domain.present !== keep || (keep && Object.keys(domain.metadata || {}).length)) {
        this.setDomain(user, domain.name, keep, {});
      }
    }
  }

  assertOperationAllowed(preferences, operation) {
    if (preferences.level === SYNC_LEVELS.NONE) {
      throw new SyncError('sync_disabled', 'Cloud sync is disabled.', 403);
    }
    if (preferences.level === SYNC_LEVELS.FULL_ACCOUNT) return;
    if (operation.type !== 'tag.set') {
      throw new SyncError('operation_out_of_scope', 'Only selected tag assignments may sync.', 403);
    }
    const tag = normalizeTag(operation.tag);
    const selected = new Set(preferences.selectedTags.map((item) => normalizeTag(item).key));
    if (!selected.has(tag.key)) {
      throw new SyncError('tag_not_selected', 'This tag is not selected for cloud sync.', 403);
    }
  }

  applyOperation(user, preferences, operation) {
    this.assertOperationAllowed(preferences, operation);
    const name = normalizeName(operation.name);

    if (operation.type === 'tag.set') {
      const tag = normalizeTag(operation.tag);
      const present = operation.present !== false;
      this.setTag(user, name, tag, present);
      if (present) {
        const metadata = preferences.level === SYNC_LEVELS.FULL_ACCOUNT
          ? sanitizeMetadata(operation.metadata, preferences)
          : {};
        this.setDomain(user, name, true, metadata);
      } else if (preferences.level === SYNC_LEVELS.SELECTED_TAGS
        && this.presentTagsForDomain(user, name).length === 0) {
        this.setDomain(user, name, false);
      }
      return;
    }

    if (operation.type === 'domain.upsert') {
      this.setDomain(user, name, true, sanitizeMetadata(operation.metadata, preferences));
      return;
    }

    if (operation.type === 'domain.delete') {
      for (const tag of this.presentTagsForDomain(user, name)) {
        this.setTag(user, name, normalizeTag(tag.displayLabel), false);
      }
      this.setDomain(user, name, false);
      return;
    }

    throw new SyncError('invalid_operation', `Unsupported operation type: ${operation.type}`);
  }

  push(deviceToken, operations) {
    const device = this.authenticateDevice(deviceToken);
    return this.pushForUser(device.userId, operations);
  }

  pushForUser(authenticatedUserId, operations) {
    const user = this.ensureUser(authenticatedUserId);
    if (!Array.isArray(operations) || operations.length > 500) {
      throw new SyncError('invalid_operations', 'Operations must be an array of at most 500 items.');
    }

    const accepted = [];
    for (const operation of operations) {
      const operationId = String(operation?.id || '').trim();
      if (!operationId) throw new SyncError('invalid_operation_id', 'Every operation needs an id.');
      if (user.operationIds.has(operationId)) {
        accepted.push(operationId);
        continue;
      }
      this.applyOperation(user, user.preferences, operation);
      user.operationIds.add(operationId);
      accepted.push(operationId);
    }

    return { accepted, cursor: user.nextRevision - 1 };
  }

  pull(deviceToken, after = 0) {
    const device = this.authenticateDevice(deviceToken);
    const user = this.ensureUser(device.userId);
    const cursor = Number.isFinite(Number(after)) && Number(after) >= 0 ? Number(after) : 0;
    return {
      preferences: { ...user.preferences },
      changes: user.events.filter((event) => event.revision > cursor).map((event) => ({ ...event })),
      cursor: user.nextRevision - 1
    };
  }

  exportForUser(authenticatedUserId) {
    const user = this.ensureUser(authenticatedUserId);
    return {
      schemaVersion: 1,
      preferences: { ...user.preferences },
      domains: [...user.domains.values()]
        .filter((domain) => domain.present)
        .map((domain) => ({ name: domain.name, metadata: { ...domain.metadata } }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      tags: [...user.tags.values()]
        .filter((tag) => tag.present)
        .map((tag) => ({ name: tag.name, tag: tag.displayLabel }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.tag.localeCompare(b.tag))
    };
  }

  deleteSyncDataForUser(authenticatedUserId) {
    const user = this.ensureUser(authenticatedUserId);
    for (const tag of [...user.tags.values()]) {
      if (tag.present) this.setTag(user, tag.name, normalizeTag(tag.displayLabel), false, {
        propagateToLocal: false
      });
    }
    for (const domain of [...user.domains.values()]) {
      if (domain.present) this.setDomain(user, domain.name, false);
    }
    user.preferences = normalizePreferences();
    return { deleted: true, cursor: user.nextRevision - 1 };
  }

  deleteSyncData(deviceToken) {
    const device = this.authenticateDevice(deviceToken);
    return this.deleteSyncDataForUser(device.userId);
  }

  listDevicesForUser(authenticatedUserId) {
    this.ensureUser(authenticatedUserId);
    return [...this.devices.values()]
      .filter((device) => device.userId === String(authenticatedUserId))
      .map(publicDevice)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  revokeDeviceForUser(authenticatedUserId, deviceId) {
    const device = this.devices.get(deviceId);
    if (!device || device.userId !== String(authenticatedUserId)) {
      throw new SyncError('device_not_found', 'Device not found.', 404);
    }
    if (!device.revokedAt) device.revokedAt = this.now().toISOString();
    return publicDevice(device);
  }
}

module.exports = {
  MemorySyncStore,
  SYNC_LEVELS,
  SyncError,
  normalizeName,
  normalizePreferences,
  normalizeTag,
  sanitizeMetadata
};
