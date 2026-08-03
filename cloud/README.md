# HNS Investments Cloud Sync Service

This directory contains the optional GFAVIP-authenticated web and synchronization
service for HNS Investments. It is deliberately outside `src/`, so Electron Builder
does not include server code in desktop packages.

The service is not deployed or registered in the GFAVIP Wallet catalog by this
repository. Production hostname, callback, service ID, owner, support contact, and
deployment approval are still required.

The verified Wallet-side contract and onboarding conditions are recorded in
`../docs/GFAVIP_WALLET_SSO_INTEGRATION_SPEC.md`.

## Implemented boundaries

- New accounts default to `none`; pairing or GFAVIP sign-in alone uploads nothing.
- `selected_tags` accepts only explicitly selected tag assignments.
- `full_account` accepts domain display metadata through a strict allowlist.
- Wallet labels require separate consent.
- Wallet secrets, balances, owner hashes, Bob files, credentials, and signing access
  are rejected or omitted.
- Desktop pairing uses an independent one-use secret and a revocable app-scoped
  device credential.
- GFAVIP callbacks accept only a one-time code and server-owned state. User identity
  comes only from server-to-server code exchange.
- Web mutations use secure sessions and CSRF protection.
- Cloud records can be exported and deleted; devices can be revoked.

## Local development

Requires Node.js 22 or newer.

Generate a local storage key in the current shell without writing it into the
repository:

```bash
export SYNC_STORAGE_KEY="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
export PUBLIC_BASE_URL="http://127.0.0.1:4319"
export HNS_CLOUD_SYNC_URL="http://127.0.0.1:4319"
npm run cloud:start
```

The real GFAVIP Wallet will not accept an unregistered local callback. Automated
tests inject a fake code exchanger; production testing requires an owner-approved
HTTPS hostname and Wallet allowlist entry.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `SYNC_STORAGE_KEY` | Yes | Base64url-encoded 32-byte key for the encrypted sync store. Keep it outside git. |
| `SYNC_STORAGE_PATH` | No | Encrypted data file. Defaults to `cloud-data/sync.enc`. |
| `PUBLIC_BASE_URL` | Production | Exact public HTTPS origin used for callbacks and pairing links. |
| `WALLET_SSO_SERVICE` | Production | Stable, Wallet-approved service ID. Current code default is provisional. |
| `WALLET_SSO_AUTHORIZE_URL` | No | Defaults to the GFAVIP Wallet code authorization endpoint. |
| `WALLET_SSO_EXCHANGE_URL` | No | Defaults to the GFAVIP Wallet server-side code exchange endpoint. |
| `PORT` / `HOST` | No | Listener configuration. Defaults to `4319` / `127.0.0.1`. |

The desktop reads `HNS_CLOUD_SYNC_URL` at startup. With no value, its Cloud Sync
screen is visibly local-only and no cloud request is made.

## Storage

The initial service uses an atomic AES-256-GCM encrypted file with owner-only file
permissions. It supports one service process and a persistent volume. The encryption
key is never stored in the data file.

Before horizontal scaling, replace this adapter with a transactional shared database
that preserves the tested store contract, per-user isolation, monotonic revisions,
idempotency keys, tombstones, device revocation, and encrypted credentials. Do not
run multiple writers against the encrypted file.

## Verification

```bash
npm run test:unit
npm test
git diff --check
```

Tests cover the policy core, authenticated HTTP flow, web management, encrypted
restart persistence, desktop offline queue, cross-account isolation, scope downgrade,
device revocation, cloud deletion, and a desktop-to-cloud end-to-end synchronization
path.
