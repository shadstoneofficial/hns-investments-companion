const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { EncryptedFileSyncStore } = require('../cloud/src/encryptedFileSyncStore');

function connect(store, userId) {
  const pairing = store.createPairing({ deviceName: 'Persistent computer' });
  store.approvePairing({ pairingId: pairing.id, authenticatedUserId: userId });
  return store.claimPairing({ pairingId: pairing.id, pollToken: pairing.pollToken }).deviceToken;
}

test('encrypted storage survives restart without exposing names or credentials at rest', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hns-cloud-store-'));
  const filePath = path.join(directory, 'sync.enc');
  const storageKey = crypto.randomBytes(32).toString('base64url');

  try {
    const first = new EncryptedFileSyncStore({ filePath, storageKey });
    const token = connect(first, 'user-1');
    first.setPreferences(token, { level: 'full_account' });
    first.push(token, [{ id: 'one', type: 'tag.set', name: 'alice', tag: 'AI agent' }]);

    const rawFile = fs.readFileSync(filePath);
    assert.equal(rawFile.subarray(0, 5).toString('utf8'), 'HNSC1');
    assert.equal(rawFile.includes(Buffer.from('alice')), false);
    assert.equal(rawFile.includes(Buffer.from(token)), false);
    assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);

    const restarted = new EncryptedFileSyncStore({ filePath, storageKey });
    assert.deepEqual(restarted.exportForUser('user-1').tags, [{ name: 'alice', tag: 'AI agent' }]);
    assert.equal(restarted.getPreferences(token).level, 'full_account');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('encrypted storage fails closed when configured with the wrong key', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hns-cloud-store-'));
  const filePath = path.join(directory, 'sync.enc');
  const storageKey = crypto.randomBytes(32).toString('base64url');

  try {
    const store = new EncryptedFileSyncStore({ filePath, storageKey });
    store.createPairing({ deviceName: 'Computer' });
    assert.throws(
      () => new EncryptedFileSyncStore({
        filePath,
        storageKey: crypto.randomBytes(32).toString('base64url')
      }),
      (error) => error.code === 'storage_decryption_failed'
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
