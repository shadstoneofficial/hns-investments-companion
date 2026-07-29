const fs = require('node:fs/promises');
const path = require('node:path');

const STORE_VERSION = 1;
const MAX_TAGS_PER_DOMAIN = 20;
const MAX_TAG_LENGTH = 32;

function normalizeDomainName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTags(values) {
  if (!Array.isArray(values)) return [];

  const tags = [];
  const seen = new Set();
  for (const value of values) {
    const tag = String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS_PER_DOMAIN) break;
  }

  return tags;
}

function normalizeStore(value) {
  const source = value?.domains && typeof value.domains === 'object' ? value.domains : {};
  const domains = {};

  for (const [name, tags] of Object.entries(source)) {
    const domain = normalizeDomainName(name);
    const normalizedTags = normalizeTags(tags);
    if (domain && normalizedTags.length) {
      domains[domain] = normalizedTags;
    }
  }

  return { version: STORE_VERSION, domains };
}

async function readDomainTagStore(filePath) {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return normalizeStore(JSON.parse(contents));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return normalizeStore();
    }
    throw error;
  }
}

async function writeDomainTags(filePath, name, tags) {
  const domain = normalizeDomainName(name);
  if (!domain) throw new Error('A domain name is required.');

  const store = await readDomainTagStore(filePath);
  const normalizedTags = normalizeTags(tags);
  if (normalizedTags.length) {
    store.domains[domain] = normalizedTags;
  } else {
    delete store.domains[domain];
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  await fs.rename(temporaryPath, filePath);
  return store;
}

module.exports = {
  normalizeStore,
  normalizeTags,
  readDomainTagStore,
  writeDomainTags
};
