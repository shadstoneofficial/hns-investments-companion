const REGISTRY_BASE_URL = 'https://raw.githubusercontent.com/shadstoneofficial/hns-community-registry/main/data';
const REGISTRY_REPO_URL = 'https://github.com/shadstoneofficial/hns-community-registry';
const REGISTRY_DATA_URL = `${REGISTRY_REPO_URL}/tree/main/data`;

const registryFiles = {
  apps: 'apps.json',
  newsSources: 'news-sources.json',
  fundingSources: 'funding-sources.json',
  fundingProposals: 'funding-proposals.json'
};

function githubIssuesApiUrl(sourceUrl) {
  const match = String(sourceUrl || '').match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/?$/);
  if (!match) return '';
  return `https://api.github.com/repos/${match[1]}/${match[2]}/issues?state=open&per_page=50`;
}

function decodeXml(text) {
  return String(text || '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number(value)));
}

function stripTags(text) {
  return decodeXml(String(text || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function atomLink(block) {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (alternate) return decodeXml(alternate[1]);
  const any = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (any) return decodeXml(any[1]);
  return xmlTag(block, 'link');
}

async function fetchRegistryFile(fileName) {
  const url = `${REGISTRY_BASE_URL}/${fileName}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`${fileName} returned ${response.status}`);
  }

  return response.json();
}

async function fetchGithubIssueProposals(source) {
  const apiUrl = githubIssuesApiUrl(source.sourceUrl);
  if (!apiUrl) return [];

  const response = await fetch(apiUrl, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'hns-investments-companion'
    }
  });

  if (!response.ok) {
    throw new Error(`${source.id} GitHub issues returned ${response.status}`);
  }

  const issues = await response.json();
  if (!Array.isArray(issues)) return [];

  return issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => {
      const summary = String(issue.body || '')
        .split(/\n{2,}/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .find(Boolean) || 'Open funding proposal from source issue.';

      return {
        id: `${source.id}-issue-${issue.number}`,
        title: issue.title || `Issue #${issue.number}`,
        summary: summary.slice(0, 220),
        sourceUrl: issue.html_url,
        projectDnsUrl: '',
        projectHnsUrl: '',
        projectUrl: issue.html_url,
        requestedAmount: '',
        currency: '',
        pledgedAmount: '',
        pledgeSourceUrl: '',
        status: issue.state === 'open' ? 'open' : 'closed',
        tags: (issue.labels || []).map((label) => label.name).filter(Boolean),
        proposer: {
          name: issue.user?.login || '',
          url: issue.user?.html_url || ''
        },
        registryLabels: ['community-submitted', 'unverified'],
        lastVerified: new Date().toISOString().slice(0, 10),
        notes: `Discovered from ${source.name}.`
      };
    });
}

async function fetchNewsItems(source) {
  if (!source.feedUrl) return [];

  const response = await fetch(source.feedUrl, {
    headers: {
      accept: 'application/atom+xml, application/rss+xml, text/xml',
      'user-agent': 'hns-investments-companion'
    }
  });

  if (!response.ok) {
    throw new Error(`${source.id} feed returned ${response.status}`);
  }

  const xml = await response.text();
  const atomEntries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const rssEntries = atomEntries.length ? [] : [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entries = atomEntries.length ? atomEntries : rssEntries;

  return entries.slice(0, 12).map((entry, index) => {
    const title = stripTags(xmlTag(entry, 'title')) || 'Untitled update';
    const publishedAt = xmlTag(entry, 'updated') || xmlTag(entry, 'published') || xmlTag(entry, 'pubDate') || '';
    const summary = stripTags(xmlTag(entry, 'summary') || xmlTag(entry, 'content') || xmlTag(entry, 'description'))
      .slice(0, 220);
    const sourceUrl = atomLink(entry) || source.website || source.feedUrl;

    return {
      id: `${source.id}-${index}-${Buffer.from(title).toString('hex').slice(0, 12)}`,
      title,
      summary: summary || `Update from ${source.name}.`,
      sourceName: source.name,
      sourceId: source.id,
      sourceUrl,
      feedUrl: source.feedUrl,
      publishedAt,
      topics: source.topics || [],
      registryLabels: source.registryLabels || [],
      dnsUrl: source.dnsUrl || '',
      hnsUrl: source.hnsUrl || '',
      website: source.website || ''
    };
  });
}

async function loadCommunityRegistry() {
  const loadedAt = new Date().toISOString();
  const result = {
    ok: true,
    status: 'connected',
    loadedAt,
    source: 'shadstoneofficial/hns-community-registry',
    apps: [],
    newsSources: [],
    fundingSources: [],
    fundingProposals: [],
    newsItems: [],
    errors: [],
    repoUrl: REGISTRY_REPO_URL,
    dataUrl: REGISTRY_DATA_URL
  };

  for (const [key, fileName] of Object.entries(registryFiles)) {
    try {
      const data = await fetchRegistryFile(fileName);
      result[key] = Array.isArray(data.entries)
        ? data.entries.map((entry) => ({
          ...entry,
          registrySourceUrl: `${REGISTRY_REPO_URL}/blob/main/data/${fileName}`
        }))
        : [];
    } catch (error) {
      result.ok = false;
      result.status = 'partial';
      result.errors.push({
        file: fileName,
        message: error.message || String(error)
      });
    }
  }

  if (result.errors.length === Object.keys(registryFiles).length) {
    result.status = 'unavailable';
  }

  for (const source of result.fundingSources) {
    if (source.sourceType !== 'github-issues') continue;
    try {
      const proposals = await fetchGithubIssueProposals(source);
      const existingIds = new Set(result.fundingProposals.map((proposal) => proposal.id));
      for (const proposal of proposals) {
        if (!existingIds.has(proposal.id)) {
          result.fundingProposals.push(proposal);
        }
      }
    } catch (error) {
      result.ok = false;
      result.status = result.status === 'unavailable' ? result.status : 'partial';
      result.errors.push({
        file: source.sourceUrl,
        message: error.message || String(error)
      });
    }
  }

  for (const source of result.newsSources) {
    try {
      const items = await fetchNewsItems(source);
      result.newsItems.push(...items);
    } catch (error) {
      result.ok = false;
      result.status = result.status === 'unavailable' ? result.status : 'partial';
      result.errors.push({
        file: source.feedUrl,
        message: error.message || String(error)
      });
    }
  }

  result.newsItems.sort((a, b) => {
    const aTime = Date.parse(a.publishedAt || '') || 0;
    const bTime = Date.parse(b.publishedAt || '') || 0;
    return bTime - aTime;
  });

  return result;
}

module.exports = {
  loadCommunityRegistry
};
