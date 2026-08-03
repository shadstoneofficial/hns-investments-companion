const crypto = require('node:crypto');
const http = require('node:http');
const { URL, URLSearchParams } = require('node:url');
const { MemorySyncStore, SyncError } = require('./syncCore');

const MAX_BODY_BYTES = 256 * 1024;
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const AUTH_STATE_LIFETIME_MS = 10 * 60 * 1000;

function randomSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
}

function sendJson(res, status, body) {
  securityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(`${JSON.stringify(body)}\n`);
}

function sendHtml(res, status, body) {
  securityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function redirect(res, location) {
  securityHeaders(res);
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new SyncError('body_too_large', 'Request body is too large.', 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (_error) {
    throw new SyncError('invalid_json', 'Request body must be valid JSON.');
  }
}

async function readForm(req) {
  return new URLSearchParams(await readBody(req));
}

function bearerToken(req, scheme = 'Bearer') {
  const header = String(req.headers.authorization || '');
  const prefix = `${scheme} `;
  return header.startsWith(prefix) ? header.slice(prefix.length).trim() : '';
}

function htmlPage(title, content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} · HNS Investments</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; color: #202124; background: #f6f3ee; }
      body { max-width: 760px; margin: 0 auto; padding: 40px 20px; }
      main { padding: 24px; border: 1px solid #d8d3c8; border-radius: 10px; background: white; }
      h1 { margin-top: 0; } p, li { line-height: 1.5; } .muted { color: #667085; }
      button, .button { display: inline-block; padding: 10px 14px; border: 0; border-radius: 6px; color: white; background: #0d6b64; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
      button.secondary, .button.secondary { color: #202124; border: 1px solid #d8d3c8; background: white; }
      form { margin: 14px 0; } label { display: block; margin: 8px 0; } input[type="text"] { width: 100%; max-width: 520px; padding: 9px; border: 1px solid #d8d3c8; border-radius: 6px; font: inherit; }
      section { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e8e3da; } ul { padding-left: 20px; } .inline { display: inline; margin: 0 0 0 8px; } .danger { background: #9a2d25; }
      table { width: 100%; border-collapse: collapse; } th, td { padding: 9px; border-bottom: 1px solid #e8e3da; text-align: left; vertical-align: top; } th { color: #667085; font-size: 12px; text-transform: uppercase; }
    </style>
  </head>
  <body><main>${content}</main></body>
</html>`;
}

function normalizeConfig(config = {}) {
  const publicBaseUrl = String(config.publicBaseUrl || 'http://127.0.0.1:4319').replace(/\/$/, '');
  return {
    publicBaseUrl,
    walletAuthorizeUrl: config.walletAuthorizeUrl || 'https://wallet.gfavip.com/api/auth/sso/authorize',
    walletExchangeUrl: config.walletExchangeUrl || 'https://wallet.gfavip.com/api/auth/sso/exchange',
    serviceId: config.serviceId || 'hns-investments',
    supportEmail: String(config.supportEmail || '').trim(),
    cookieSecure: config.cookieSecure ?? publicBaseUrl.startsWith('https://')
  };
}

async function defaultExchangeCode(code, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(config.walletExchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`GFAVIP exchange failed with ${response.status}`);
    const identity = await response.json();
    if (!identity?.user_id) throw new Error('GFAVIP exchange response is missing user_id');
    return identity;
  } finally {
    clearTimeout(timeout);
  }
}

function createCloudServer(options = {}) {
  const store = options.store || new MemorySyncStore();
  const config = normalizeConfig(options.config);
  const now = options.now || (() => new Date());
  const exchangeCode = options.exchangeCode || ((code) => defaultExchangeCode(code, config));
  const sessions = new Map();
  const authStates = new Map();
  const rateLimits = new Map();

  function consumeRateLimit(req, bucket, maximum = 20, windowMs = 10 * 60 * 1000) {
    const address = req.socket.remoteAddress || 'unknown';
    const key = `${bucket}:${address}`;
    const currentTime = now().getTime();
    const existing = rateLimits.get(key);
    const value = !existing || existing.resetsAt <= currentTime
      ? { count: 0, resetsAt: currentTime + windowMs }
      : existing;
    value.count += 1;
    rateLimits.set(key, value);
    if (value.count > maximum) {
      throw new SyncError('rate_limited', 'Too many requests. Try again later.', 429);
    }
  }

  function createSession(userId) {
    const token = randomSecret();
    const session = {
      userId: String(userId),
      csrfToken: randomSecret(),
      expiresAt: new Date(now().getTime() + SESSION_LIFETIME_MS).toISOString()
    };
    sessions.set(hashSecret(token), session);
    return { token, session };
  }

  function sessionForRequest(req) {
    const token = parseCookies(req.headers.cookie).hns_sync_session;
    if (!token) return null;
    const session = sessions.get(hashSecret(token));
    if (!session || new Date(session.expiresAt).getTime() <= now().getTime()) return null;
    return session;
  }

  function requireWebSession(req) {
    const session = sessionForRequest(req);
    if (!session) throw new SyncError('authentication_required', 'GFAVIP sign-in is required.', 401);
    return session;
  }

  function requireCsrf(req, session, suppliedToken) {
    if (!suppliedToken || suppliedToken !== session.csrfToken) {
      throw new SyncError('invalid_csrf', 'Request verification failed.', 403);
    }
  }

  function setSessionCookie(res, token) {
    const secure = config.cookieSecure ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `hns_sync_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_MS / 1000}${secure}`
    );
  }

  function accountPage(session, filters = {}) {
    const exported = store.exportForUser(session.userId);
    const preferences = store.getPreferencesForUser(session.userId);
    const devices = store.listDevicesForUser(session.userId);
    const checked = (level) => preferences.level === level ? ' checked' : '';
    const tags = exported.tags.length
      ? `<ul>${exported.tags.map((item) => `<li><code>${escapeHtml(item.name)}</code> — ${escapeHtml(item.tag)}
          <form class="inline" method="post" action="/account/tags/remove">
            <input type="hidden" name="csrfToken" value="${escapeHtml(session.csrfToken)}">
            <input type="hidden" name="name" value="${escapeHtml(item.name)}">
            <input type="hidden" name="tag" value="${escapeHtml(item.tag)}">
            <button class="secondary" type="submit">Remove</button>
          </form></li>`).join('')}</ul>`
      : '<p class="muted">No domain tags are stored in the cloud.</p>';
    const deviceList = devices.length
      ? `<ul>${devices.map((device) => `<li>${escapeHtml(device.displayName)}${device.revokedAt ? ' — revoked' : ''}
          ${device.revokedAt ? '' : `<form class="inline" method="post" action="/account/devices/revoke">
            <input type="hidden" name="csrfToken" value="${escapeHtml(session.csrfToken)}">
            <input type="hidden" name="deviceId" value="${escapeHtml(device.id)}">
            <button class="secondary" type="submit">Revoke</button>
          </form>`}</li>`).join('')}</ul>`
      : '<p class="muted">No devices are connected.</p>';
    const query = String(filters.query || '').trim().toLowerCase();
    const tagFilter = String(filters.tag || '').trim().toLowerCase();
    const tagsByName = new Map();
    for (const item of exported.tags) {
      if (!tagsByName.has(item.name)) tagsByName.set(item.name, []);
      tagsByName.get(item.name).push(item.tag);
    }
    const domainRows = exported.domains.filter((domain) => {
      const domainTags = tagsByName.get(domain.name) || [];
      return (!query || domain.name.toLowerCase().includes(query)
          || domainTags.some((tag) => tag.toLowerCase().includes(query)))
        && (!tagFilter || domainTags.some((tag) => tag.toLowerCase() === tagFilter));
    });
    const portfolioTable = domainRows.length
      ? `<table><thead><tr><th>Domain</th><th>Tags</th><th>Status</th><th>Renewal height</th></tr></thead><tbody>${domainRows.map((domain) => {
        const metadata = domain.metadata || {};
        return `<tr><td><code>${escapeHtml(domain.name)}</code></td><td>${escapeHtml((tagsByName.get(domain.name) || []).join(', '))}</td><td>${escapeHtml(metadata.status || '')}</td><td>${escapeHtml(metadata.renewalHeight || '')}</td></tr>`;
      }).join('')}</tbody></table>`
      : '<p class="muted">No cloud domains match this filter.</p>';
    const filterOptions = [...new Set(exported.tags.map((item) => item.tag))]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => `<option value="${escapeHtml(tag)}"${tag.toLowerCase() === tagFilter ? ' selected' : ''}>${escapeHtml(tag)}</option>`)
      .join('');

    return htmlPage('Cloud account', `
      <h1>Cloud Sync</h1>
      <p class="muted">Signed in with GFAVIP. Domain data remains local unless a cloud level is selected.</p>
      <section>
        <h2>Privacy level</h2>
        <form method="post" action="/account/preferences">
          <input type="hidden" name="csrfToken" value="${escapeHtml(session.csrfToken)}">
          <label><input type="radio" name="level" value="none"${checked('none')}> <strong>No cloud sync</strong> — default</label>
          <label><input type="radio" name="level" value="selected_tags"${checked('selected_tags')}> <strong>Sync selected tags</strong></label>
          <label><input type="radio" name="level" value="full_account"${checked('full_account')}> <strong>Sync full domain account</strong></label>
          <label>Selected tags, separated by commas
            <input type="text" name="selectedTags" value="${escapeHtml(preferences.selectedTags.join(', '))}" placeholder="AI agent, first name">
          </label>
          <label><input type="checkbox" name="syncWalletLabels"${preferences.syncWalletLabels ? ' checked' : ''}> Include wallet display labels in full-account sync</label>
          <label><input type="checkbox" name="retainCloudData"${preferences.retainCloudData ? ' checked' : ''}> When turning sync off, retain the existing cloud copy instead of deleting it</label>
          <button type="submit">Save privacy level</button>
        </form>
        <p class="muted">Seed phrases, private keys, wallet passwords, Bob files, balances, and signing access are never synced.</p>
      </section>
      <section>
        <h2>Cloud portfolio</h2>
        ${preferences.level === 'selected_tags' ? '<p class="muted"><strong>Partial portfolio:</strong> this account shows only selected tags and their domain names.</p>' : ''}
        <form method="get" action="/account">
          <label>Search <input type="text" name="q" value="${escapeHtml(filters.query || '')}" placeholder="Domain or tag"></label>
          <label>Filter by tag <select name="tag"><option value="">Any tag</option>${filterOptions}</select></label>
          <button type="submit">Filter</button> <a class="button secondary" href="/account">Clear</a>
        </form>
        ${portfolioTable}
      </section>
      <section>
        <h2>Synced tags</h2>
        ${tags}
        <form method="post" action="/account/tags/add">
          <input type="hidden" name="csrfToken" value="${escapeHtml(session.csrfToken)}">
          <label>Domain <input type="text" name="name" required></label>
          <label>Tag <input type="text" name="tag" required></label>
          ${preferences.level === 'selected_tags' ? '<label><input type="checkbox" name="selectTag"> Add this tag to my selected sync list</label>' : ''}
          <button type="submit">Add cloud tag</button>
        </form>
      </section>
      <section><h2>Connected devices</h2>${deviceList}</section>
      <section>
        <h2>Your data</h2>
        <p><a class="button secondary" href="/api/v1/account/export">Export cloud data</a></p>
        <form method="post" action="/account/delete">
          <input type="hidden" name="csrfToken" value="${escapeHtml(session.csrfToken)}">
          <button class="danger" type="submit">Delete all cloud sync data</button>
        </form>
        <form method="post" action="/auth/logout"><button class="secondary" type="submit">Sign out</button></form>
      </section>`);
  }

  async function handle(req, res) {
    const url = new URL(req.url, config.publicBaseUrl);

    if (req.method === 'GET' && url.pathname === '/') {
      const session = sessionForRequest(req);
      const content = session
        ? `<h1>HNS Investments Cloud</h1><p>Signed in with GFAVIP.</p><p><a class="button" href="/account">Manage synced domains</a></p>`
        : '<h1>HNS Investments Cloud</h1><p>Optional cloud backup and synchronization for HNS Investments domain metadata.</p><p class="muted">Desktop pairing is required before data can sync.</p><p><a href="/privacy">Privacy and data controls</a></p>';
      sendHtml(res, 200, htmlPage('Cloud Sync', content));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/privacy') {
      const support = config.supportEmail
        ? `<p>Support: <a href="mailto:${escapeHtml(config.supportEmail)}">${escapeHtml(config.supportEmail)}</a></p>`
        : '<p class="muted">The production support contact is pending owner confirmation.</p>';
      sendHtml(res, 200, htmlPage('Privacy', `
        <h1>Cloud Sync privacy</h1>
        <p>Cloud Sync is optional and starts off. GFAVIP sign-in or device approval alone does not upload portfolio data.</p>
        <h2>Data that may be stored</h2>
        <ul><li>Domain names and selected user tags at the selected-tag level</li><li>Domain display metadata and all user tags at the full-account level</li><li>Optional wallet display labels only with separate consent</li><li>Connected-device identifiers and synchronization revisions</li></ul>
        <h2>Data never included</h2>
        <p>Seed phrases, private keys, wallet passwords, Bob files, bridge credentials, owner hashes, balances, transaction evidence, and signing access are excluded.</p>
        <h2>Your controls</h2>
        <p>The web account and desktop application provide export, cloud deletion, and device revocation. Deleting the cloud copy does not remove local tags.</p>
        ${support}`));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/device-pairings') {
      consumeRateLimit(req, 'pairing', 10);
      const body = await readJson(req);
      const pairing = store.createPairing({ deviceName: body.deviceName });
      sendJson(res, 201, {
        ...pairing,
        authorizeUrl: `${config.publicBaseUrl}/auth/login?pairing=${encodeURIComponent(pairing.id)}`
      });
      return;
    }

    const pairingMatch = url.pathname.match(/^\/api\/v1\/device-pairings\/([^/]+)$/);
    if (req.method === 'GET' && pairingMatch) {
      const result = store.claimPairing({
        pairingId: decodeURIComponent(pairingMatch[1]),
        pollToken: bearerToken(req, 'Pairing')
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/login') {
      consumeRateLimit(req, 'auth-login', 30);
      const pairingId = url.searchParams.get('pairing');
      const destination = url.searchParams.get('destination');
      let returnPath;
      if (pairingId) {
        store.pairing(pairingId);
        returnPath = `/connect?pairing=${encodeURIComponent(pairingId)}`;
      } else if (destination === 'account') {
        returnPath = '/account';
      } else {
        throw new SyncError('invalid_auth_destination', 'A valid sign-in destination is required.');
      }
      const state = randomSecret();
      authStates.set(hashSecret(state), {
        pairingId,
        returnPath,
        expiresAt: new Date(now().getTime() + AUTH_STATE_LIFETIME_MS).toISOString()
      });
      const callbackUrl = new URL(`${config.publicBaseUrl}/auth/callback`);
      callbackUrl.searchParams.set('state', state);
      const authorizationUrl = new URL(config.walletAuthorizeUrl);
      authorizationUrl.searchParams.set('redirect_uri', callbackUrl.toString());
      authorizationUrl.searchParams.set('service', config.serviceId);
      authorizationUrl.searchParams.set('flow', 'code');
      authorizationUrl.searchParams.set('state', state);
      redirect(res, authorizationUrl.toString());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const stateRecord = state ? authStates.get(hashSecret(state)) : null;
      if (!code || !stateRecord || new Date(stateRecord.expiresAt).getTime() <= now().getTime()) {
        throw new SyncError('invalid_auth_callback', 'The sign-in request is missing, invalid, or expired.', 400);
      }
      authStates.delete(hashSecret(state));
      const identity = await exchangeCode(code);
      if (!identity?.user_id) throw new SyncError('invalid_identity', 'GFAVIP sign-in failed.', 401);
      const { token } = createSession(identity.user_id);
      setSessionCookie(res, token);
      redirect(res, stateRecord.returnPath);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/connect') {
      const pairingId = url.searchParams.get('pairing');
      const pairing = store.pairing(pairingId);
      const session = sessionForRequest(req);
      if (!session) {
        redirect(res, `/auth/login?pairing=${encodeURIComponent(pairingId)}`);
        return;
      }
      sendHtml(res, 200, htmlPage('Connect device', `
        <h1>Connect this device?</h1>
        <p>Allow <strong>${escapeHtml(pairing.displayName)}</strong> to synchronize HNS Investments domain metadata according to your selected privacy level.</p>
        <p class="muted">Wallet secrets, seed phrases, private keys, and signing access are never included.</p>
        <form method="post" action="/connect/approve">
          <input type="hidden" name="pairingId" value="${escapeHtml(pairingId)}">
          <input type="hidden" name="csrfToken" value="${escapeHtml(session.csrfToken)}">
          <button type="submit">Approve device</button>
        </form>`));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/connect/approve') {
      const session = requireWebSession(req);
      const form = await readForm(req);
      requireCsrf(req, session, form.get('csrfToken'));
      const device = store.approvePairing({
        pairingId: form.get('pairingId'),
        authenticatedUserId: session.userId
      });
      sendHtml(res, 200, htmlPage('Device connected', `
        <h1>Device connected</h1>
        <p><strong>${escapeHtml(device.displayName)}</strong> can now return to the desktop application.</p>
        <p class="muted">No data uploads until a cloud sync level is explicitly selected.</p>`));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/logout') {
      const token = parseCookies(req.headers.cookie).hns_sync_session;
      if (token) sessions.delete(hashSecret(token));
      res.setHeader('Set-Cookie', 'hns_sync_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      redirect(res, '/');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/account') {
      const session = sessionForRequest(req);
      if (!session) {
        redirect(res, '/auth/login?destination=account');
        return;
      }
      sendHtml(res, 200, accountPage(session, {
        query: url.searchParams.get('q') || '',
        tag: url.searchParams.get('tag') || ''
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/account/preferences') {
      const session = requireWebSession(req);
      const form = await readForm(req);
      requireCsrf(req, session, form.get('csrfToken'));
      store.setPreferencesForUser(session.userId, {
        level: form.get('level'),
        selectedTags: String(form.get('selectedTags') || '').split(','),
        syncWalletLabels: form.has('syncWalletLabels'),
        retainCloudData: form.has('retainCloudData')
      });
      redirect(res, '/account');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/account/tags/add') {
      const session = requireWebSession(req);
      const form = await readForm(req);
      requireCsrf(req, session, form.get('csrfToken'));
      const tag = form.get('tag');
      const preferences = store.getPreferencesForUser(session.userId);
      if (preferences.level === 'selected_tags' && form.has('selectTag')) {
        store.setPreferencesForUser(session.userId, {
          ...preferences,
          selectedTags: [...preferences.selectedTags, tag]
        });
      }
      store.pushForUser(session.userId, [{
        id: `web:${crypto.randomUUID()}`,
        type: 'tag.set',
        name: form.get('name'),
        tag,
        present: true
      }]);
      redirect(res, '/account');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/account/tags/remove') {
      const session = requireWebSession(req);
      const form = await readForm(req);
      requireCsrf(req, session, form.get('csrfToken'));
      store.pushForUser(session.userId, [{
        id: `web:${crypto.randomUUID()}`,
        type: 'tag.set',
        name: form.get('name'),
        tag: form.get('tag'),
        present: false
      }]);
      redirect(res, '/account');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/account/devices/revoke') {
      const session = requireWebSession(req);
      const form = await readForm(req);
      requireCsrf(req, session, form.get('csrfToken'));
      store.revokeDeviceForUser(session.userId, form.get('deviceId'));
      redirect(res, '/account');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/account/delete') {
      const session = requireWebSession(req);
      const form = await readForm(req);
      requireCsrf(req, session, form.get('csrfToken'));
      store.deleteSyncDataForUser(session.userId);
      redirect(res, '/account');
      return;
    }

    const deviceToken = bearerToken(req);
    if (req.method === 'GET' && url.pathname === '/api/v1/sync/preferences') {
      sendJson(res, 200, store.getPreferences(deviceToken));
      return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/v1/sync/preferences') {
      sendJson(res, 200, store.setPreferences(deviceToken, await readJson(req)));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/sync/operations') {
      const body = await readJson(req);
      sendJson(res, 200, store.push(deviceToken, body.operations));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/sync/changes') {
      sendJson(res, 200, store.pull(deviceToken, url.searchParams.get('after') || 0));
      return;
    }
    if (req.method === 'DELETE' && url.pathname === '/api/v1/sync/data') {
      sendJson(res, 200, store.deleteSyncData(deviceToken));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/account/export') {
      const session = requireWebSession(req);
      sendJson(res, 200, store.exportForUser(session.userId));
      return;
    }
    if (req.method === 'DELETE' && url.pathname === '/api/v1/account/sync-data') {
      const session = requireWebSession(req);
      requireCsrf(req, session, req.headers['x-csrf-token']);
      sendJson(res, 200, store.deleteSyncDataForUser(session.userId));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/account/devices') {
      const session = requireWebSession(req);
      sendJson(res, 200, { devices: store.listDevicesForUser(session.userId) });
      return;
    }
    const deviceMatch = url.pathname.match(/^\/api\/v1\/account\/devices\/([^/]+)$/);
    if (req.method === 'DELETE' && deviceMatch) {
      const session = requireWebSession(req);
      requireCsrf(req, session, req.headers['x-csrf-token']);
      sendJson(res, 200, store.revokeDeviceForUser(session.userId, decodeURIComponent(deviceMatch[1])));
      return;
    }

    sendJson(res, 404, { error: 'not_found', message: 'Route not found.' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      const status = error instanceof SyncError ? error.status : 500;
      const code = error instanceof SyncError ? error.code : 'internal_error';
      const message = error instanceof SyncError ? error.message : 'An unexpected error occurred.';
      sendJson(res, status, { error: code, message });
    });
  });

  return { server, store, config };
}

module.exports = {
  createCloudServer,
  defaultExchangeCode,
  normalizeConfig
};
