# GFAVIP Cloud Sync Production Handoff

See `GFAVIP_WALLET_SSO_INTEGRATION_SPEC.md` for the source-verified Wallet
authorization, exchange, state, identity, registry, error, logout, and test
contract reviewed on 2026-08-03.

The Cloud Sync implementation is complete locally but is not deployed, registered in
the GFAVIP Wallet catalog, or enabled in desktop release builds. Those actions require
explicit owner approval and the production values below.

## Owner decisions required

- Public HTTPS origin for the sync service.
- Stable GFAVIP Wallet service ID and exact callback allowlist entry:
  `<PUBLIC_BASE_URL>/auth/callback`.
- Support and privacy contact shown on the service privacy page.
- Hosting owner, persistent-volume backup policy, and encryption-key custodian.
- Whether the initial single-process encrypted-file store is acceptable for launch or
  a transactional shared database is required before launch.
- Desktop release in which `HNS_CLOUD_SYNC_URL` will be configured.

## Production configuration

Keep these values in the deployment secret/configuration system, never in git:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `PUBLIC_BASE_URL` | Approved HTTPS origin, with no trailing path |
| `WALLET_SSO_SERVICE` | Wallet-approved stable service ID |
| `SYNC_STORAGE_KEY` | Base64url-encoded 32-byte secret, backed up separately |
| `SYNC_STORAGE_PATH` | Persistent encrypted storage path |
| `SUPPORT_EMAIL` | Owner-approved support/privacy contact |
| `HOST` / `PORT` | Hosting-platform listener settings |

Set `HNS_CLOUD_SYNC_URL` to the same approved origin when producing an enabled desktop
build. A build without this value remains visibly local-only and makes no Cloud Sync
requests.

## Approval-gated rollout

1. Provision one service instance and a backed-up persistent volume, or first replace
   the file adapter with a transactional shared database if horizontal scaling is
   required.
2. Store the encryption key and configuration in the hosting secret manager.
3. Register the exact service ID and callback with GFAVIP Wallet.
4. Deploy to the approved HTTPS origin without publishing it in the app catalog.
5. Run live Wallet code-flow tests with a test GFAVIP account. Confirm forged identity
   parameters are ignored and the authorization state is single use.
6. Test two desktop devices: pairing, selected-tag sync, full metadata sync, offline
   edits, merge, restore, revocation, export, and cloud deletion.
7. Confirm switching to no cloud and deleting cloud data never removes local tags.
8. Review the privacy page and support contact, then obtain owner approval for the
   desktop endpoint and catalog listing.
9. Produce signed/notarized desktop builds and perform a clean-machine Gatekeeper
   test before release.

## Go-live evidence

- Automated tests pass with `npm run test:unit` and the Bob bridge smoke passes with
  `npm test`.
- TLS, security headers, cookies, CSRF protection, request-size limits, and pairing
  rate limits are verified against the deployed origin.
- Storage survives a service restart and fails closed when given the wrong encryption
  key.
- Revoked device credentials fail immediately.
- An account export contains only the chosen sync scope.
- Cloud deletion removes server data but preserves local desktop tags.
- No seed phrase, private key, wallet password, Bob file, bridge credential, owner
  hash, balance, transaction evidence, or signing capability appears in requests,
  logs, storage, or exports.

Do not deploy, register the service, inject production secrets, publish a catalog
entry, or create a public release until the owner explicitly approves those actions.
