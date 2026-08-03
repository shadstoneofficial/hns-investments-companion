# GFAVIP Wallet SSO Integration Specification

Status: Ready with conditions  
Verified: 2026-08-03  
Wallet source reviewed: `gfavip-wallet` at `c8a7cc1cd4c8052d6dd85f4c8cbf2d95f4bebbe0`  
Companion baseline reviewed: `hns-investments-companion` at `7c085f3f5cfe5fc12283ca4bd6cc0ab6d745e3eb`

This document records the repository-verifiable Wallet contract for the optional
HNS Investments Cloud Sync service. It does not authorize deployment, production
registration, catalog publication, secret changes, or a desktop release.

## Authoritative Wallet contract

### Authorization

Use a top-level browser navigation to:

```text
GET https://wallet.gfavip.com/api/auth/sso/authorize
  ?redirect_uri=<URL-encoded exact callback>
  &service=<stable service ID>
  &flow=code
```

For this service the callback must be constructed as:

```text
<PUBLIC_BASE_URL>/auth/callback
```

`PUBLIC_BASE_URL` must be an HTTPS origin without credentials, a path, query,
or fragment. HNS adds its random authorization state to the callback URL before
placing that callback in `redirect_uri`. It also sends a standalone `state`
parameter for compatibility, but current Wallet source does not read or return
that standalone parameter.

Wallet creates the success redirect by parsing `redirect_uri` and setting its
`code` query parameter. Existing callback query parameters are therefore
preserved. The resulting callback is equivalent to:

```text
<PUBLIC_BASE_URL>/auth/callback?state=<HNS one-use state>&code=<Wallet code>
```

When the Wallet user is signed out, Wallet redirects to its `/auth` page with the
authorize request in `return_to`. Wallet's auth client restores `flow=code` before
resuming authorization after login. An existing Wallet session skips that login
screen and proceeds directly to code issuance.

`mode=signin` and `mode=signup` are accepted Wallet hints but are not required by
HNS. Current Wallet source has no OAuth-style consent screen and no implemented
authorization cancellation redirect contract.

### Current allowlist and service behavior

The current `sso_domains` registry contains:

- `domain`: a unique hostname
- `service_name`: an administrative label
- `description`
- `is_active`

At authorization time Wallet parses `redirect_uri`, looks up only its hostname,
and requires an active row. It does **not** currently:

- require HTTPS in the authorize handler;
- compare an exact scheme, port, path, query, or callback URI;
- bind the supplied `service` value to `sso_domains.service_name`; or
- reject an unregistered service ID when the hostname is active.

Consequently, “exact callback allowlisting” and a true service registry binding
are not features of the current Wallet implementation. The Wallet administrator
action available today is to add the approved production hostname with an
administrative service name and activate it. HNS must still emit only its exact
HTTPS callback. Any future Wallet hardening to exact registered redirect URIs and
service binding must be coordinated across existing consumers rather than added
as an HNS-only production exception.

### Code exchange

HNS must call the exchange endpoint server-to-server with a five-second timeout:

```http
POST https://wallet.gfavip.com/api/auth/sso/exchange
Content-Type: application/json

{"code":"<one-time code>"}
```

Success is HTTP 200 JSON with these fields:

```json
{
  "token": "gfavip-session-...",
  "user_id": "<stable Wallet user UUID>",
  "email": "user@example.com",
  "username": "username",
  "tier": "free-or-paid-tier",
  "credits": 0,
  "shard_balance": 0,
  "gems_exact": 0,
  "tier_expires_at": null,
  "member_number": null,
  "agent_context": null
}
```

`user_id` is the stable user identifier for Cloud Sync ownership. HNS uses only
the exchange response's `user_id`. Callback `user_id`, `email`, `username`, tier,
or other identity-looking query parameters are ignored. HNS does not need the
returned Wallet session token for its app-scoped device-pairing design and must
not persist it merely because the exchange returns it. Wallet returns the stored
tier unchanged except that `superadmin` is projected as `team` to external apps.

The Wallet code is 32 random bytes represented as 64 hexadecimal characters. It
expires 60 seconds after issuance. Exchange atomically marks it used before user
lookup, so concurrent or later reuse fails. Wallet responses are:

| Condition | HTTP | JSON error |
| --- | ---: | --- |
| Missing/non-string code | 400 | `code_required` |
| Unknown code | 400 | `invalid_code` |
| Already claimed code | 400 | `code_used` |
| Expired code | 400 | `code_expired` |
| Referenced Wallet user missing | 404 | `user_not_found` |
| Exchange IP ceiling exceeded | 429 | `rate_limit_exceeded` |
| Unexpected failure | 500 | `server_error` |

HNS fails closed on a timeout, non-200 response, invalid JSON, or missing
`user_id`.

### Authorization errors and cancellation

The authorize endpoint returns JSON directly for current failures; it does not
redirect an OAuth error to the callback:

| Condition | HTTP | JSON error |
| --- | ---: | --- |
| Missing `redirect_uri` or `service` | 400 | descriptive `error` string |
| Hostname absent/inactive | 403 | `Domain not authorized for SSO` |
| Rate limited | 429 | `rate_limit_exceeded` plus retry seconds |
| Parse/internal failure | 500 | `server_error` |

Wallet has no current cancel control that returns `error=access_denied`. HNS still
handles such a callback defensively: it consumes valid state, exchanges no code,
and reports `wallet_authorization_failed`. A missing code with valid state is
treated the same way. This is forward-compatible behavior, not a claim that
Wallet currently emits that response.

### State and return continuity

HNS state is random, server-side, one-use, and valid for ten minutes. It records
one of two server-constructed return paths only:

- `/connect?pairing=<server-created pairing ID>`
- `/account`

The callback consumes valid state before processing success, cancellation, or
Wallet error. Invalid, replayed, or expired state fails before code exchange.
The service never accepts a caller-supplied absolute return URL, protocol-relative
URL, cross-origin URL, or arbitrary local path. Desktop pairing returns to the
exact pairing approval page; signed-out web-account access returns to `/account`.

### Session and logout behavior

Wallet's login session is a Passport session cookie with a 30-day maximum age and
`SameSite=Lax`; an existing session can make a later authorization immediate.
Wallet issues a separate 30-day SSO session token alongside every authorization
code, and exchange returns that token.

HNS creates its own HTTP-only, `SameSite=Lax`, eight-hour web session using only
the exchanged `user_id`. `POST /auth/logout` deletes the HNS session and redirects
to `/`; it does not log the browser out of Wallet. Wallet-wide logout/switch-account
is a separate top-level navigation:

```text
GET https://wallet.gfavip.com/api/auth/sso/logout?return_to=<allowlisted HTTPS URL>
```

Wallet validates that return hostname using the same hostname registry, calls
Passport logout, destroys its web session, clears its cookie, and redirects. It
does not visibly revoke previously issued 30-day partner SSO tokens. HNS currently
does not use or store the returned Wallet token, so local HNS logout remains the
appropriate default. A future explicit “Switch GFAVIP account” action may use the
Wallet logout endpoint after its exact return behavior is tested.

## Identity search and recommendation

The current Wallet catalog (`server/apps-catalog.ts`) and the repository's SSO
domain registry snapshot (`docs/security-audit/sso-domains-list.md`) were searched
case-insensitively for identities normalized by removing punctuation. No match was
found for `hnsinvestments` or `hnsinvestmentscompanion`.

The registry snapshot is dated 2026-02-21 and is not a substitute for an
administrator query of the live `sso_domains` table. Before registration, a Wallet
administrator must repeat the normalized search against current production data.

Recommendation: use `hns-investments` if the live query also finds no appropriate
existing identity. It matches the official product identity, the existing
provisional code default, and is less coupled to the current desktop “Companion”
packaging than `hns-investments-companion`. Reuse any appropriate existing stable
identity found by the live normalized search; do not create a duplicate.

No catalog ID is being proposed or published now. SSO onboarding and an optional
future Wallet catalog listing are separate decisions.

## Values required from the owner

Before a Cloud-Sync-enabled macOS build, obtain written confirmation of:

1. Approved production HTTPS origin, with no path, query, or fragment.
2. Exact callback: `<approved-origin>/auth/callback`.
3. Stable service ID, after the live normalized registry search.
4. Legal person or entity responsible for the service.
5. Public support and privacy contact, plus public privacy/support URLs if a
   catalog listing will be prepared.
6. Official member-facing app name.
7. Authorized, durable app-owned HTTPS icon URL (preferably square 512×512 PNG or
   WebP), not a temporary repository URL.
8. Supported platforms for Cloud Sync and for any later catalog listing. The
   repository currently evidences desktop packaging for macOS, Windows, and Linux;
   the cloud account is web-based. Android and iOS are not evidenced.
9. Whether a Wallet catalog listing is wanted now or later. “Later” is recommended
   until production SSO, pairing, privacy, deletion, and support tests pass.
10. Cloud retention/deletion timing, hosting owner, storage/backup policy,
    encryption-key custodian, and whether the single-writer encrypted file store
    is acceptable for initial production.

## Repository findings and changes

The existing HNS flow correctly:

- requests Wallet `flow=code`;
- embeds state in the callback `redirect_uri`;
- exchanges codes only server-to-server;
- derives ownership only from exchange `user_id`;
- returns to the exact pairing or web-account destination;
- defaults to no sync and uploads no data merely because a user signs in; and
- excludes wallet secrets, credentials, balances, owner hashes, Bob files,
  transaction evidence, and signing access.

Safe local corrections made during this review:

- `cloud/src/httpServer.js`: consume valid state on success, cancellation, missing
  code, or Wallet error; delete expired state; return a bounded cancellation/error;
  require `PUBLIC_BASE_URL` to be an origin.
- `tests/cloudHttpServer.test.js`: cover successful state replay, cancellation state
  consumption, expired state, no code exchange on failures, and exact-origin config.

No Wallet source change is required to test HNS against the current contract. No
production registry, allowlist, catalog, secret, deployment, or release state was
changed.

## Test-environment procedure

Use an owner-approved non-production HTTPS origin and a non-production/test Wallet
registry row. Keep the catalog unchanged.

1. Configure the service with the test HTTPS origin, chosen test service ID, a
   test storage key, and an isolated storage path. Confirm the authorize URL's
   decoded callback is exactly `<test-origin>/auth/callback?state=...`.
2. Desktop pairing, signed-out Wallet: create a pairing, open its browser URL,
   sign in to Wallet, and verify the callback returns to that exact device's
   `/connect?pairing=...` page. Approve it and verify the desktop claims its device
   credential once.
3. Desktop pairing, existing Wallet session: repeat with a second named device and
   verify the same pairing page is reached without losing the pairing ID.
4. Web account: in a signed-out HNS session request `/account`; complete Wallet SSO
   and verify the final path is exactly `/account`, including on first login.
5. Wallet code one-use: capture a test code, exchange it once successfully, then
   repeat the exchange and require HTTP 400 `code_used`. Delay a fresh code more
   than 60 seconds and require `code_expired`.
6. State replay/expiry: replay a completed HNS callback and require
   `invalid_auth_callback` without another exchange. Advance/wait beyond ten
   minutes for a fresh HNS state and require the same result.
7. Forged identity: add callback `user_id`, `email`, `username`, and tier parameters
   that disagree with the exchange response. Verify the HNS session and all stored
   ownership use only exchange `user_id`.
8. Pairing return isolation: start two pairings in separate clean browser contexts;
   complete them in reverse order and verify each callback reaches only its own
   approval page.
9. Cancellation/failures: simulate callback `error=access_denied` with valid state
   and require `wallet_authorization_failed`, no exchange, and failed replay. Test
   missing code, invalid hostname (403), authorize rate limit (429), exchange
   timeout, invalid JSON, `invalid_code`, `code_expired`, and Wallet 500; all must
   fail closed without an HNS session.
10. Logout: verify HNS logout removes only the HNS session. Verify a later HNS login
    may reuse the Wallet session. Separately navigate through Wallet SSO logout and
    verify the next authorization requires Wallet authentication; do not assume it
    revokes previously issued Wallet tokens.

Record status codes, final paths, and redacted correlation timestamps. Never record
codes, cookies, tokens, domain portfolios, or private account data.

## Readiness verdict

**Ready with conditions.** The repository-local SSO, state, identity, and return
continuity behavior is suitable for test-environment validation. A
Cloud-Sync-enabled macOS release remains gated on owner-confirmed production
identity and origin, a live Wallet registry search, Wallet administrator hostname
registration, test-environment evidence, privacy/retention decisions, deployment,
and explicit release approval.

Responsibilities are separate:

- **Code findings:** corrections and automated tests listed above.
- **Owner decisions:** all values and policies in “Values required from the owner.”
- **Wallet administrator actions:** live normalized identity search and, only after
  approval, active production hostname registration; catalog work only if requested.
- **Deployment actions:** provision storage/secrets/TLS, deploy, run live tests,
  configure `HNS_CLOUD_SYNC_URL`, sign/notarize, and release—each still unperformed.
