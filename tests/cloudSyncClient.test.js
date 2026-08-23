const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createCloudSyncClient, normalizeEndpoint } = require('../src/main/cloudSyncClient');

function fakeVault() {
  return {
    available: true,
    encrypt: (value) => Buffer.from(`encrypted:${value}`, 'utf8').toString('base64'),
    decrypt: (value) => Buffer.from(value, 'base64').toString('utf8').replace(/^encrypted:/, '')
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

test('cloud client is local-only by default and rejects unsafe endpoints', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-client-'));
  let calls = 0;
  try {
    const client = createCloudSyncClient({
      statePath: path.join(directory, 'state.json'),
      endpoint: '',
      vault: fakeVault(),
      fetchImpl: async () => { calls += 1; }
    });
    const state = await client.getState();
    assert.equal(state.preferences.level, 'none');
    assert.equal(state.connected, false);
    assert.equal(calls, 0);
    assert.throws(() => normalizeEndpoint('http://sync.example.test'), /requires HTTPS/);
    assert.equal(normalizeEndpoint('http://127.0.0.1:4319'), 'http://127.0.0.1:4319');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('reading cloud state does not initialize the credential vault', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-client-'));
  let availabilityChecks = 0;
  const vault = fakeVault();
  Object.defineProperty(vault, 'available', {
    get() {
      availabilityChecks += 1;
      return true;
    }
  });

  try {
    const client = createCloudSyncClient({
      statePath: path.join(directory, 'state.json'),
      endpoint: 'https://sync.example.test',
      vault,
      fetchImpl: async (url) => {
        assert.equal(url, 'https://sync.example.test/api/v1/device-pairings');
        return response(201, {
          id: 'pair-1',
          pollToken: 'poll-secret',
          authorizeUrl: 'https://sync.example.test/auth/login?pairing=pair-1',
          expiresAt: '2030-01-01T00:00:00.000Z'
        });
      }
    });

    const state = await client.getState();
    assert.equal(state.credentialStorageAvailable, null);
    assert.equal(availabilityChecks, 0);

    const pairingState = await client.startPairing('Janice Mac');
    assert.equal(pairingState.credentialStorageAvailable, true);
    assert.equal(availabilityChecks, 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('pairing credentials are encrypted in local state and approved token enables sync', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-client-'));
  const calls = [];
  try {
    const client = createCloudSyncClient({
      statePath: path.join(directory, 'state.json'),
      endpoint: 'https://sync.example.test',
      vault: fakeVault(),
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, options });
        if (url.endsWith('/api/v1/device-pairings')) {
          return response(201, {
            id: 'pair-1',
            pollToken: 'poll-secret',
            authorizeUrl: 'https://sync.example.test/auth/login?pairing=pair-1',
            expiresAt: '2030-01-01T00:00:00.000Z'
          });
        }
        if (url.endsWith('/api/v1/device-pairings/pair-1')) {
          assert.equal(options.headers.Authorization, 'Pairing poll-secret');
          return response(200, { status: 'approved', deviceId: 'device-1', deviceToken: 'device-secret' });
        }
        if (url.endsWith('/api/v1/sync/preferences')) {
          assert.equal(options.headers.Authorization, 'Bearer device-secret');
          return response(200, { level: 'none' });
        }
        throw new Error(`Unexpected URL ${url}`);
      }
    });
    await client.startPairing('Janice Mac');
    const raw = await fs.readFile(path.join(directory, 'state.json'), 'utf8');
    assert.equal(raw.includes('poll-secret'), false);
    const state = await client.pollPairing();
    assert.equal(state.connected, true);
    const connectedRaw = await fs.readFile(path.join(directory, 'state.json'), 'utf8');
    assert.equal(connectedRaw.includes('device-secret'), false);
    assert.equal(calls.length, 3);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('selected-tag queue excludes local-only tags and retries after network failure', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-client-'));
  let failPush = true;
  const pushed = [];
  try {
    const statePath = path.join(directory, 'state.json');
    await fs.writeFile(statePath, JSON.stringify({
      encryptedDeviceToken: fakeVault().encrypt('device-secret'),
      preferences: { level: 'selected_tags', selectedTags: ['AI agent'] }
    }));
    const client = createCloudSyncClient({
      statePath,
      endpoint: 'https://sync.example.test',
      vault: fakeVault(),
      fetchImpl: async (url, options) => {
        if (url.endsWith('/api/v1/sync/operations')) {
          if (failPush) return response(503, { error: 'offline', message: 'Try later' });
          const operations = JSON.parse(options.body).operations;
          pushed.push(...operations);
          return response(200, { accepted: operations.map((item) => item.id), cursor: 4 });
        }
        throw new Error(`Unexpected URL ${url}`);
      }
    });
    await client.queueTagDiff('alice', [], ['AI agent', 'First name']);
    assert.equal((await client.getState()).pendingCount, 1);
    await assert.rejects(() => client.flush(), /Try later/);
    assert.equal((await client.getState()).pendingCount, 1);
    failPush = false;
    await client.flush();
    assert.equal((await client.getState()).pendingCount, 0);
    assert.equal(pushed[0].tag, 'AI agent');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('full-account snapshot queues only display-safe metadata', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-client-'));
  const pushed = [];
  try {
    const statePath = path.join(directory, 'state.json');
    await fs.writeFile(statePath, JSON.stringify({
      encryptedDeviceToken: fakeVault().encrypt('device-secret'),
      preferences: { level: 'full_account', syncWalletLabels: false }
    }));
    const client = createCloudSyncClient({
      statePath,
      endpoint: 'https://sync.example.test',
      vault: fakeVault(),
      fetchImpl: async (_url, options) => {
        const operations = JSON.parse(options.body).operations;
        pushed.push(...operations);
        return response(200, { accepted: operations.map((item) => item.id), cursor: 8 });
      }
    });
    await client.queuePortfolio([{
      name: 'alice',
      unicodeName: 'alice',
      isIdn: false,
      status: 'owned',
      renewalHeight: 400000,
      wallet: 'Private wallet',
      ownerHash: 'never-send'
    }], { domains: { alice: ['AI agent'] } });
    await client.flush();
    const domain = pushed.find((operation) => operation.type === 'domain.upsert');
    assert.equal(domain.metadata.walletLabel, undefined);
    assert.equal(domain.metadata.ownerHash, undefined);
    assert.equal(JSON.stringify(pushed).includes('never-send'), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('later snapshots queue tombstones for domains and tags removed locally', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-client-'));
  const pushed = [];
  try {
    const statePath = path.join(directory, 'state.json');
    await fs.writeFile(statePath, JSON.stringify({
      encryptedDeviceToken: fakeVault().encrypt('device-secret'),
      preferences: { level: 'full_account' }
    }));
    const client = createCloudSyncClient({
      statePath,
      endpoint: 'https://sync.example.test',
      vault: fakeVault(),
      fetchImpl: async (_url, options) => {
        const operations = JSON.parse(options.body).operations;
        pushed.push(...operations);
        return response(200, { accepted: operations.map((item) => item.id), cursor: 20 });
      }
    });
    await client.queuePortfolio([{ name: 'alice', status: 'owned' }], {
      domains: { alice: ['AI agent'] }
    });
    await client.flush();
    pushed.length = 0;
    await client.queuePortfolio([], { domains: {} });
    await client.flush();
    assert.ok(pushed.some((operation) => operation.type === 'domain.delete' && operation.name === 'alice'));
    assert.ok(pushed.some((operation) => operation.type === 'tag.set' && operation.present === false));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
