const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { once } = require('node:events');
const { createCloudServer } = require('../cloud/src/httpServer');
const { createCloudSyncClient } = require('../src/main/cloudSyncClient');
const { applyDomainTagChanges, readDomainTagStore, writeDomainTags } = require('../src/main/domainTagStore');

function testVault() {
  return {
    available: true,
    encrypt: (value) => Buffer.from(`protected:${value}`, 'utf8').toString('base64'),
    decrypt: (value) => Buffer.from(value, 'base64').toString('utf8').replace(/^protected:/, '')
  };
}

test('desktop and cloud complete pairing, full sync, web edit, restore, and cloud deletion', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-cloud-e2e-'));
  const tagFile = path.join(directory, 'domain-tags.json');
  const secondTagFile = path.join(directory, 'second-domain-tags.json');
  const stateFile = path.join(directory, 'cloud-state.json');
  const secondStateFile = path.join(directory, 'second-cloud-state.json');
  const cloud = createCloudServer({
    config: { publicBaseUrl: 'http://127.0.0.1:1', cookieSecure: false },
    exchangeCode: async () => ({ user_id: 'gfavip-user-1' })
  });
  cloud.server.listen(0, '127.0.0.1');
  await once(cloud.server, 'listening');
  const address = cloud.server.address();
  const endpoint = `http://127.0.0.1:${address.port}`;
  cloud.config.publicBaseUrl = endpoint;

  try {
    await writeDomainTags(tagFile, 'alice', ['AI agent']);
    const client = createCloudSyncClient({
      statePath: stateFile,
      endpoint,
      vault: testVault()
    });
    const pairingState = await client.startPairing('End-to-end computer');
    cloud.store.approvePairing({
      pairingId: pairingState.pairing.id,
      authenticatedUserId: 'gfavip-user-1'
    });
    assert.equal((await client.pollPairing()).connected, true);

    await client.setPreferences({ level: 'full_account' });
    await client.queuePortfolio([{
      name: 'alice',
      status: 'owned',
      renewalHeight: 400000,
      ownerHash: 'excluded'
    }], await readDomainTagStore(tagFile));
    await client.flush();
    await client.pull();

    const exported = cloud.store.exportForUser('gfavip-user-1');
    assert.deepEqual(exported.tags, [{ name: 'alice', tag: 'AI agent' }]);
    assert.equal(JSON.stringify(exported).includes('excluded'), false);

    const secondClient = createCloudSyncClient({
      statePath: secondStateFile,
      endpoint,
      vault: testVault()
    });
    const secondPairing = await secondClient.startPairing('Second computer');
    cloud.store.approvePairing({
      pairingId: secondPairing.pairing.id,
      authenticatedUserId: 'gfavip-user-1'
    });
    await secondClient.pollPairing();
    const restored = await secondClient.pull();
    await applyDomainTagChanges(secondTagFile, restored.changes);
    assert.deepEqual((await readDomainTagStore(secondTagFile)).domains.alice, ['AI agent']);

    cloud.store.pushForUser('gfavip-user-1', [{
      id: 'web-edit',
      type: 'tag.set',
      name: 'alice',
      tag: 'First name',
      present: true
    }]);
    const webChanges = await client.pull();
    await applyDomainTagChanges(tagFile, webChanges.changes);
    assert.deepEqual((await readDomainTagStore(tagFile)).domains.alice, ['AI agent', 'First name']);

    await client.deleteCloudData();
    assert.deepEqual(cloud.store.exportForUser('gfavip-user-1').domains, []);
    assert.deepEqual((await readDomainTagStore(tagFile)).domains.alice, ['AI agent', 'First name']);
  } finally {
    cloud.server.close();
    await once(cloud.server, 'close');
    await fs.rm(directory, { recursive: true, force: true });
  }
});
