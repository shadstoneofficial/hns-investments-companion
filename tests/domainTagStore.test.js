const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applyDomainTagChanges,
  normalizeTags,
  readDomainTagStore,
  writeDomainTags
} = require('../src/main/domainTagStore');

test('normalizeTags trims, deduplicates, and preserves display casing', () => {
  assert.deepEqual(
    normalizeTags([' AI agent ', 'First   Name', 'ai AGENT', '', null]),
    ['AI agent', 'First Name']
  );
});

test('domain tags persist by normalized domain name and can be removed', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-domain-tags-'));
  const filePath = path.join(directory, 'domain-tags.json');

  try {
    const saved = await writeDomainTags(filePath, 'Alice', ['AI agent', 'First name']);
    assert.deepEqual(saved.domains.alice, ['AI agent', 'First name']);

    const loaded = await readDomainTagStore(filePath);
    assert.deepEqual(loaded, saved);

    const cleared = await writeDomainTags(filePath, 'ALICE', []);
    assert.deepEqual(cleared.domains, {});
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('a missing or malformed tag file safely produces an empty store', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-domain-tags-'));
  const filePath = path.join(directory, 'domain-tags.json');

  try {
    assert.deepEqual(await readDomainTagStore(filePath), { version: 1, domains: {} });
    await fs.writeFile(filePath, '{not json', 'utf8');
    assert.deepEqual(await readDomainTagStore(filePath), { version: 1, domains: {} });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('cloud tag changes merge with local-only tags and honor tombstones', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hns-domain-tags-'));
  const filePath = path.join(directory, 'domain-tags.json');

  try {
    await writeDomainTags(filePath, 'alice', ['Local only', 'AI agent']);
    await applyDomainTagChanges(filePath, [
      { type: 'tag', name: 'alice', displayLabel: 'AI agent', present: false },
      { type: 'tag', name: 'alice', displayLabel: 'First name', present: true },
      { type: 'tag', name: 'alice', displayLabel: 'Local only', present: false, propagateToLocal: false },
      { type: 'domain', name: 'ignored', present: true }
    ]);
    assert.deepEqual((await readDomainTagStore(filePath)).domains.alice, ['Local only', 'First name']);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
