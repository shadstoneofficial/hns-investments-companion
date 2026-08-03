const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MemorySyncStore,
  SYNC_LEVELS,
  SyncError
} = require('../cloud/src/syncCore');

function connect(store, userId, deviceName = 'Test computer') {
  const pairing = store.createPairing({ deviceName });
  const device = store.approvePairing({
    pairingId: pairing.id,
    authenticatedUserId: userId
  });
  const claim = store.claimPairing({ pairingId: pairing.id, pollToken: pairing.pollToken });
  return { ...device, token: claim.deviceToken };
}

test('new users default to no sync and uploads fail closed', () => {
  const store = new MemorySyncStore();
  const device = connect(store, 'user-1');

  assert.deepEqual(store.getPreferences(device.token), {
    level: SYNC_LEVELS.NONE,
    selectedTags: [],
    syncWalletLabels: false,
    retainCloudData: false
  });
  assert.throws(
    () => store.push(device.token, [{ id: 'one', type: 'tag.set', name: 'alice', tag: 'AI agent' }]),
    (error) => error instanceof SyncError && error.code === 'sync_disabled'
  );
  assert.deepEqual(store.exportForUser('user-1').domains, []);
});

test('selected-tag sync accepts only selected assignments and stores minimal domain data', () => {
  const store = new MemorySyncStore();
  const device = connect(store, 'user-1');
  store.setPreferences(device.token, {
    level: SYNC_LEVELS.SELECTED_TAGS,
    selectedTags: ['AI agent']
  });

  store.push(device.token, [{
    id: 'one',
    type: 'tag.set',
    name: 'Alice',
    tag: 'AI Agent',
    metadata: { status: 'owned', ownerHash: 'private-evidence' }
  }]);
  assert.throws(
    () => store.push(device.token, [{ id: 'two', type: 'tag.set', name: 'alice', tag: 'First name' }]),
    (error) => error.code === 'tag_not_selected'
  );

  assert.deepEqual(store.exportForUser('user-1'), {
    schemaVersion: 1,
    preferences: {
      level: SYNC_LEVELS.SELECTED_TAGS,
      selectedTags: ['AI agent'],
      syncWalletLabels: false,
      retainCloudData: false
    },
    domains: [{ name: 'alice', metadata: {} }],
    tags: [{ name: 'alice', tag: 'AI Agent' }]
  });
});

test('full-account sync allowlists metadata and wallet labels require separate consent', () => {
  const store = new MemorySyncStore();
  const device = connect(store, 'user-1');
  store.setPreferences(device.token, {
    level: SYNC_LEVELS.FULL_ACCOUNT,
    syncWalletLabels: false
  });
  store.push(device.token, [{
    id: 'one',
    type: 'domain.upsert',
    name: 'example',
    metadata: {
      status: 'owned',
      renewalHeight: 400000,
      walletLabel: 'Names wallet',
      ownerHash: 'must-not-sync',
      hnsBalance: 42
    }
  }]);

  assert.deepEqual(store.exportForUser('user-1').domains, [{
    name: 'example',
    metadata: { status: 'owned', renewalHeight: 400000 }
  }]);

  store.setPreferences(device.token, {
    level: SYNC_LEVELS.FULL_ACCOUNT,
    syncWalletLabels: true
  });
  store.push(device.token, [{
    id: 'two',
    type: 'domain.upsert',
    name: 'example',
    metadata: { status: 'owned', walletLabel: 'Names wallet' }
  }]);
  assert.equal(store.exportForUser('user-1').domains[0].metadata.walletLabel, 'Names wallet');
});

test('two devices merge offline additions and pull incremental changes', () => {
  const store = new MemorySyncStore();
  const first = connect(store, 'user-1', 'First computer');
  const second = connect(store, 'user-1', 'Second computer');
  store.setPreferences(first.token, { level: SYNC_LEVELS.FULL_ACCOUNT });

  const initial = store.pull(second.token, 0);
  store.push(first.token, [{ id: 'first-op', type: 'tag.set', name: 'alice', tag: 'AI agent' }]);
  store.push(second.token, [{ id: 'second-op', type: 'tag.set', name: 'alice', tag: 'First name' }]);
  const incremental = store.pull(first.token, initial.cursor);

  assert.deepEqual(
    store.exportForUser('user-1').tags.map((item) => item.tag),
    ['AI agent', 'First name']
  );
  assert.ok(incremental.changes.some((change) => change.displayLabel === 'AI agent'));
  assert.ok(incremental.changes.some((change) => change.displayLabel === 'First name'));
});

test('downgrading selected scope removes out-of-scope assignments and orphan domains', () => {
  const store = new MemorySyncStore();
  const device = connect(store, 'user-1');
  store.setPreferences(device.token, { level: SYNC_LEVELS.FULL_ACCOUNT });
  store.push(device.token, [
    { id: 'one', type: 'tag.set', name: 'alice', tag: 'AI agent' },
    { id: 'two', type: 'tag.set', name: 'alice', tag: 'First name' },
    { id: 'three', type: 'tag.set', name: 'run', tag: 'Action' }
  ]);

  store.setPreferences(device.token, {
    level: SYNC_LEVELS.SELECTED_TAGS,
    selectedTags: ['AI agent']
  });
  assert.deepEqual(store.exportForUser('user-1').domains, [{ name: 'alice', metadata: {} }]);
  assert.deepEqual(store.exportForUser('user-1').tags, [{ name: 'alice', tag: 'AI agent' }]);
  const scopeRemoval = store.pull(device.token, 0).changes
    .find((change) => change.type === 'tag' && change.displayLabel === 'First name' && !change.present);
  assert.equal(scopeRemoval.propagateToLocal, false);
});

test('pairing claims credentials once and revoked devices immediately lose access', () => {
  const store = new MemorySyncStore();
  const pairing = store.createPairing({ deviceName: 'Janice Mac' });
  assert.deepEqual(store.claimPairing({ pairingId: pairing.id, pollToken: pairing.pollToken }), {
    status: 'pending'
  });
  const device = store.approvePairing({ pairingId: pairing.id, authenticatedUserId: 'user-1' });
  const claim = store.claimPairing({ pairingId: pairing.id, pollToken: pairing.pollToken });
  assert.equal(claim.status, 'approved');
  assert.equal(store.claimPairing({ pairingId: pairing.id, pollToken: pairing.pollToken }).status, 'claimed');

  store.revokeDeviceForUser('user-1', device.id);
  assert.throws(
    () => store.getPreferences(claim.deviceToken),
    (error) => error.code === 'invalid_device'
  );
});

test('cloud deletion clears data but keeps tombstones available to connected devices', () => {
  const store = new MemorySyncStore();
  const first = connect(store, 'user-1');
  const second = connect(store, 'user-1');
  store.setPreferences(first.token, { level: SYNC_LEVELS.FULL_ACCOUNT });
  store.push(first.token, [{ id: 'one', type: 'tag.set', name: 'alice', tag: 'AI agent' }]);
  const beforeDelete = store.pull(second.token, 0).cursor;

  store.deleteSyncDataForUser('user-1');
  assert.deepEqual(store.exportForUser('user-1').domains, []);
  const changes = store.pull(second.token, beforeDelete).changes;
  assert.ok(changes.some((change) => (
    change.type === 'tag' && change.present === false && change.propagateToLocal === false
  )));
  assert.ok(changes.some((change) => change.type === 'domain' && change.present === false));
});

test('exports and device actions are isolated by authenticated user', () => {
  const store = new MemorySyncStore();
  const first = connect(store, 'user-1');
  const second = connect(store, 'user-2');
  store.setPreferences(first.token, { level: SYNC_LEVELS.FULL_ACCOUNT });
  store.push(first.token, [{ id: 'one', type: 'domain.upsert', name: 'private-name' }]);

  assert.deepEqual(store.exportForUser('user-2').domains, []);
  assert.throws(
    () => store.revokeDeviceForUser('user-2', first.id),
    (error) => error.code === 'device_not_found'
  );
  assert.doesNotThrow(() => store.getPreferences(second.token));
});
