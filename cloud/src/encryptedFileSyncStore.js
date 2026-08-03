const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { MemorySyncStore, SyncError } = require('./syncCore');

const FILE_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const AAD = Buffer.from('hns-investments-cloud-sync-store-v1', 'utf8');

function parseStorageKey(value) {
  if (Buffer.isBuffer(value) && value.length === 32) return Buffer.from(value);
  const text = String(value || '').trim();
  let key;
  try {
    key = Buffer.from(text, 'base64url');
  } catch (_error) {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    throw new SyncError(
      'invalid_storage_key',
      'SYNC_STORAGE_KEY must be a base64url-encoded 32-byte secret.',
      500
    );
  }
  return key;
}

function mapToEntries(map, transform = (value) => value) {
  return [...map.entries()].map(([key, value]) => [key, transform(value)]);
}

function serializeStore(store) {
  return {
    version: FILE_VERSION,
    users: mapToEntries(store.users, (user) => ({
      ...user,
      domains: mapToEntries(user.domains),
      tags: mapToEntries(user.tags),
      operationIds: [...user.operationIds]
    })),
    devices: mapToEntries(store.devices),
    devicesByTokenHash: mapToEntries(store.devicesByTokenHash),
    pairings: mapToEntries(store.pairings)
  };
}

function restoreStore(store, value) {
  if (!value || value.version !== FILE_VERSION || !Array.isArray(value.users)) {
    throw new SyncError('invalid_storage_file', 'Cloud sync storage has an unsupported format.', 500);
  }
  store.users = new Map(value.users.map(([id, user]) => [id, {
    ...user,
    domains: new Map(user.domains || []),
    tags: new Map(user.tags || []),
    operationIds: new Set(user.operationIds || [])
  }]));
  store.devices = new Map(value.devices || []);
  store.devicesByTokenHash = new Map(value.devicesByTokenHash || []);
  store.pairings = new Map(value.pairings || []);
}

function encrypt(value, key) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(AAD);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('HNSC1'), nonce, tag, ciphertext]);
}

function decrypt(buffer, key) {
  if (buffer.subarray(0, 5).toString('utf8') !== 'HNSC1' || buffer.length < 34) {
    throw new SyncError('invalid_storage_file', 'Cloud sync storage is not a recognized encrypted file.', 500);
  }
  try {
    const nonce = buffer.subarray(5, 17);
    const tag = buffer.subarray(17, 33);
    const ciphertext = buffer.subarray(33);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
  } catch (_error) {
    throw new SyncError(
      'storage_decryption_failed',
      'Cloud sync storage could not be decrypted with the configured key.',
      500
    );
  }
}

class EncryptedFileSyncStore extends MemorySyncStore {
  constructor({ filePath, storageKey, ...options }) {
    super(options);
    this.filePath = path.resolve(String(filePath || ''));
    if (!filePath) throw new SyncError('missing_storage_path', 'A cloud sync storage path is required.', 500);
    this.storageKey = parseStorageKey(storageKey);
    if (fs.existsSync(this.filePath)) {
      restoreStore(this, decrypt(fs.readFileSync(this.filePath), this.storageKey));
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, encrypt(serializeStore(this), this.storageKey), { mode: 0o600 });
    fs.renameSync(temporaryPath, this.filePath);
    fs.chmodSync(this.filePath, 0o600);
  }

  createPairing(value) {
    const result = super.createPairing(value);
    this.persist();
    return result;
  }

  approvePairing(value) {
    const result = super.approvePairing(value);
    this.persist();
    return result;
  }

  claimPairing(value) {
    const result = super.claimPairing(value);
    if (result.status === 'approved') this.persist();
    return result;
  }

  getPreferences(deviceToken) {
    const result = super.getPreferences(deviceToken);
    this.persist();
    return result;
  }

  setPreferences(deviceToken, value) {
    const result = super.setPreferences(deviceToken, value);
    this.persist();
    return result;
  }

  setPreferencesForUser(userId, value) {
    const result = super.setPreferencesForUser(userId, value);
    this.persist();
    return result;
  }

  push(deviceToken, operations) {
    const result = super.push(deviceToken, operations);
    this.persist();
    return result;
  }

  pushForUser(userId, operations) {
    const result = super.pushForUser(userId, operations);
    this.persist();
    return result;
  }

  pull(deviceToken, after) {
    const result = super.pull(deviceToken, after);
    this.persist();
    return result;
  }

  deleteSyncDataForUser(userId) {
    const result = super.deleteSyncDataForUser(userId);
    this.persist();
    return result;
  }

  deleteSyncData(deviceToken) {
    const result = super.deleteSyncData(deviceToken);
    this.persist();
    return result;
  }

  revokeDeviceForUser(userId, deviceId) {
    const result = super.revokeDeviceForUser(userId, deviceId);
    this.persist();
    return result;
  }
}

module.exports = {
  EncryptedFileSyncStore,
  decrypt,
  encrypt,
  parseStorageKey,
  restoreStore,
  serializeStore
};
