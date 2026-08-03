const assert = require('node:assert/strict');
const test = require('node:test');
const { once } = require('node:events');
const { createCloudServer } = require('../cloud/src/httpServer');

async function withServer(run, options = {}) {
  const exchangedCodes = [];
  const cloud = createCloudServer({
    config: {
      publicBaseUrl: 'https://sync.example.test',
      walletAuthorizeUrl: 'https://wallet.gfavip.com/api/auth/sso/authorize',
      serviceId: 'hns-investments-test',
      cookieSecure: false
    },
    now: options.now,
    exchangeCode: async (code) => {
      exchangedCodes.push(code);
      return { user_id: 'gfavip-user-1', email: 'ignored@example.test' };
    }
  });
  cloud.server.listen(0, '127.0.0.1');
  await once(cloud.server, 'listening');
  const address = cloud.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run({ ...cloud, baseUrl, exchangedCodes });
  } finally {
    cloud.server.close();
    await once(cloud.server, 'close');
  }
}

async function json(response) {
  const body = await response.json();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return body;
}

async function pairAndSignIn(context) {
  const pairingResponse = await fetch(`${context.baseUrl}/api/v1/device-pairings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceName: 'Janice Mac' })
  });
  assert.equal(pairingResponse.status, 201);
  const pairing = await json(pairingResponse);

  const loginResponse = await fetch(
    `${context.baseUrl}/auth/login?pairing=${encodeURIComponent(pairing.id)}`,
    { redirect: 'manual' }
  );
  assert.equal(loginResponse.status, 303);
  const walletUrl = new URL(loginResponse.headers.get('location'));
  assert.equal(walletUrl.origin, 'https://wallet.gfavip.com');
  assert.equal(walletUrl.searchParams.get('flow'), 'code');
  assert.equal(walletUrl.searchParams.get('service'), 'hns-investments-test');
  const callbackUrl = new URL(walletUrl.searchParams.get('redirect_uri'));
  assert.equal(callbackUrl.origin, 'https://sync.example.test');
  assert.equal(callbackUrl.pathname, '/auth/callback');
  assert.equal(callbackUrl.searchParams.get('state'), walletUrl.searchParams.get('state'));

  const callbackResponse = await fetch(
    `${context.baseUrl}/auth/callback?code=one-time-code&state=${encodeURIComponent(walletUrl.searchParams.get('state'))}&user_id=forged-user`,
    { redirect: 'manual' }
  );
  assert.equal(callbackResponse.status, 303);
  assert.equal(callbackResponse.headers.get('location'), `/connect?pairing=${encodeURIComponent(pairing.id)}`);
  assert.deepEqual(context.exchangedCodes, ['one-time-code']);
  const cookie = callbackResponse.headers.get('set-cookie').split(';')[0];

  const connectResponse = await fetch(`${context.baseUrl}${callbackResponse.headers.get('location')}`, {
    headers: { Cookie: cookie }
  });
  const connectHtml = await connectResponse.text();
  assert.match(connectHtml, /Janice Mac/);
  const csrfToken = connectHtml.match(/name="csrfToken" value="([^"]+)"/)[1];

  const approveResponse = await fetch(`${context.baseUrl}/connect/approve`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ pairingId: pairing.id, csrfToken })
  });
  assert.equal(approveResponse.status, 200);

  const claimResponse = await fetch(`${context.baseUrl}/api/v1/device-pairings/${pairing.id}`, {
    headers: { Authorization: `Pairing ${pairing.pollToken}` }
  });
  const claim = await json(claimResponse);
  assert.equal(claim.status, 'approved');
  return { pairing, cookie, csrfToken, deviceToken: claim.deviceToken, deviceId: claim.deviceId };
}

test('GFAVIP code login preserves pairing destination and produces a one-use device credential', async () => {
  await withServer(async (context) => {
    const connected = await pairAndSignIn(context);
    const secondClaim = await fetch(
      `${context.baseUrl}/api/v1/device-pairings/${connected.pairing.id}`,
      { headers: { Authorization: `Pairing ${connected.pairing.pollToken}` } }
    );
    assert.equal((await json(secondClaim)).status, 'claimed');

    const preferences = await fetch(`${context.baseUrl}/api/v1/sync/preferences`, {
      headers: { Authorization: `Bearer ${connected.deviceToken}` }
    });
    assert.equal((await json(preferences)).level, 'none');
  });
});

test('HTTP sync enforces selected tags and supports incremental pull and web export', async () => {
  await withServer(async (context) => {
    const connected = await pairAndSignIn(context);
    const auth = { Authorization: `Bearer ${connected.deviceToken}`, 'Content-Type': 'application/json' };

    const preferencesResponse = await fetch(`${context.baseUrl}/api/v1/sync/preferences`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ level: 'selected_tags', selectedTags: ['AI agent'] })
    });
    assert.equal(preferencesResponse.status, 200);

    const pushResponse = await fetch(`${context.baseUrl}/api/v1/sync/operations`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        operations: [{ id: 'op-1', type: 'tag.set', name: 'alice', tag: 'AI agent' }]
      })
    });
    const pushed = await json(pushResponse);
    assert.deepEqual(pushed.accepted, ['op-1']);

    const changesResponse = await fetch(`${context.baseUrl}/api/v1/sync/changes?after=0`, {
      headers: { Authorization: `Bearer ${connected.deviceToken}` }
    });
    const changes = await json(changesResponse);
    assert.ok(changes.changes.some((change) => change.type === 'tag'));

    const exportResponse = await fetch(`${context.baseUrl}/api/v1/account/export`, {
      headers: { Cookie: connected.cookie }
    });
    const exported = await json(exportResponse);
    assert.deepEqual(exported.tags, [{ name: 'alice', tag: 'AI agent' }]);
  });
});

test('device approval and destructive web actions require CSRF protection', async () => {
  await withServer(async (context) => {
    const connected = await pairAndSignIn(context);
    const missingCsrf = await fetch(`${context.baseUrl}/api/v1/account/sync-data`, {
      method: 'DELETE',
      headers: { Cookie: connected.cookie }
    });
    assert.equal(missingCsrf.status, 403);
    assert.equal((await json(missingCsrf)).error, 'invalid_csrf');

    const deleted = await fetch(`${context.baseUrl}/api/v1/account/sync-data`, {
      method: 'DELETE',
      headers: { Cookie: connected.cookie, 'X-CSRF-Token': connected.csrfToken }
    });
    assert.equal(deleted.status, 200);
    assert.equal((await json(deleted)).deleted, true);
  });
});

test('a forged callback identity is ignored and invalid auth state fails closed', async () => {
  await withServer(async (context) => {
    const response = await fetch(
      `${context.baseUrl}/auth/callback?code=one-time-code&state=not-valid&user_id=attacker`,
      { redirect: 'manual' }
    );
    assert.equal(response.status, 400);
    assert.equal((await json(response)).error, 'invalid_auth_callback');
    assert.deepEqual(context.exchangedCodes, []);
  });
});

test('authorization state is single-use after a successful callback', async () => {
  await withServer(async (context) => {
    const pairingResponse = await fetch(`${context.baseUrl}/api/v1/device-pairings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: 'Replay test Mac' })
    });
    const pairing = await json(pairingResponse);
    const login = await fetch(
      `${context.baseUrl}/auth/login?pairing=${encodeURIComponent(pairing.id)}`,
      { redirect: 'manual' }
    );
    const state = new URL(login.headers.get('location')).searchParams.get('state');

    const first = await fetch(
      `${context.baseUrl}/auth/callback?code=first-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(first.status, 303);

    const replay = await fetch(
      `${context.baseUrl}/auth/callback?code=replay-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(replay.status, 400);
    assert.equal((await json(replay)).error, 'invalid_auth_callback');
    assert.deepEqual(context.exchangedCodes, ['first-code']);
  });
});

test('Wallet cancellation consumes state and never exchanges a code', async () => {
  await withServer(async (context) => {
    const pairingResponse = await fetch(`${context.baseUrl}/api/v1/device-pairings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: 'Cancelled pairing Mac' })
    });
    const pairing = await json(pairingResponse);
    const login = await fetch(
      `${context.baseUrl}/auth/login?pairing=${encodeURIComponent(pairing.id)}`,
      { redirect: 'manual' }
    );
    const state = new URL(login.headers.get('location')).searchParams.get('state');

    const cancelled = await fetch(
      `${context.baseUrl}/auth/callback?error=access_denied&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(cancelled.status, 400);
    assert.equal((await json(cancelled)).error, 'wallet_authorization_failed');

    const replay = await fetch(
      `${context.baseUrl}/auth/callback?code=late-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(replay.status, 400);
    assert.equal((await json(replay)).error, 'invalid_auth_callback');
    assert.deepEqual(context.exchangedCodes, []);
  });
});

test('expired authorization state fails closed before code exchange', async () => {
  let currentTime = new Date('2026-08-03T00:00:00.000Z');
  await withServer(async (context) => {
    const pairingResponse = await fetch(`${context.baseUrl}/api/v1/device-pairings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: 'Expired state Mac' })
    });
    const pairing = await json(pairingResponse);
    const login = await fetch(
      `${context.baseUrl}/auth/login?pairing=${encodeURIComponent(pairing.id)}`,
      { redirect: 'manual' }
    );
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    currentTime = new Date('2026-08-03T00:10:01.000Z');

    const expired = await fetch(
      `${context.baseUrl}/auth/callback?code=expired-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );
    assert.equal(expired.status, 400);
    assert.equal((await json(expired)).error, 'invalid_auth_callback');
    assert.deepEqual(context.exchangedCodes, []);
  }, { now: () => currentTime });
});

test('PUBLIC_BASE_URL must be an origin so the callback path stays exact', () => {
  assert.throws(
    () => createCloudServer({ config: { publicBaseUrl: 'https://sync.example.test/base' } }),
    /must be an HTTP or HTTPS origin/
  );
  assert.throws(
    () => createCloudServer({ config: { publicBaseUrl: 'https://sync.example.test/?tenant=one' } }),
    /must be an HTTP or HTTPS origin/
  );
});

test('web account can configure privacy, manage tags, export, and revoke a device', async () => {
  await withServer(async (context) => {
    const connected = await pairAndSignIn(context);
    const accountResponse = await fetch(`${context.baseUrl}/account`, {
      headers: { Cookie: connected.cookie }
    });
    const accountHtml = await accountResponse.text();
    assert.match(accountHtml, /No cloud sync/);
    assert.match(accountHtml, /Janice Mac/);

    const preferenceResponse = await fetch(`${context.baseUrl}/account/preferences`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: connected.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken: connected.csrfToken,
        level: 'selected_tags',
        selectedTags: 'AI agent'
      })
    });
    assert.equal(preferenceResponse.status, 303);

    const addResponse = await fetch(`${context.baseUrl}/account/tags/add`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: connected.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken: connected.csrfToken,
        name: 'alice',
        tag: 'AI agent'
      })
    });
    assert.equal(addResponse.status, 303);

    const updatedAccount = await fetch(`${context.baseUrl}/account`, {
      headers: { Cookie: connected.cookie }
    });
    assert.match(await updatedAccount.text(), /<code>alice<\/code> — AI agent/);

    const exportResponse = await fetch(`${context.baseUrl}/api/v1/account/export`, {
      headers: { Cookie: connected.cookie }
    });
    assert.deepEqual((await json(exportResponse)).tags, [{ name: 'alice', tag: 'AI agent' }]);

    const revokeResponse = await fetch(`${context.baseUrl}/account/devices/revoke`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Cookie: connected.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken: connected.csrfToken,
        deviceId: connected.deviceId
      })
    });
    assert.equal(revokeResponse.status, 303);
    const rejectedDevice = await fetch(`${context.baseUrl}/api/v1/sync/preferences`, {
      headers: { Authorization: `Bearer ${connected.deviceToken}` }
    });
    assert.equal(rejectedDevice.status, 401);
  });
});

test('signed-out web account login returns to the exact account destination', async () => {
  await withServer(async (context) => {
    const account = await fetch(`${context.baseUrl}/account`, { redirect: 'manual' });
    assert.equal(account.status, 303);
    assert.equal(account.headers.get('location'), '/auth/login?destination=account');

    const login = await fetch(`${context.baseUrl}${account.headers.get('location')}`, {
      redirect: 'manual'
    });
    const walletUrl = new URL(login.headers.get('location'));
    const callback = await fetch(
      `${context.baseUrl}/auth/callback?code=account-code&state=${encodeURIComponent(walletUrl.searchParams.get('state'))}`,
      { redirect: 'manual' }
    );
    assert.equal(callback.headers.get('location'), '/account');
  });
});

test('device pairing creation is rate limited by client address', async () => {
  await withServer(async (context) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${context.baseUrl}/api/v1/device-pairings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: `Device ${attempt}` })
      });
      assert.equal(response.status, 201);
    }

    const limited = await fetch(`${context.baseUrl}/api/v1/device-pairings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: 'One too many' })
    });
    assert.equal(limited.status, 429);
    assert.equal((await json(limited)).error, 'rate_limited');
  });
});
