# HNS Investments Companion

HNS Investments Companion is a local-first Electron app for power users who manage many Handshake TLDs in Bob LearnHNS.

The first milestone is intentionally read-only: discover the local Bob LearnHNS data footprint, identify candidate wallet/node folders, and build toward one unified portfolio table without mutating Bob wallet data.

Current status: the app detects Bob LearnHNS and candidate wallet storage. It does not yet enumerate owned names. The next integration is a read-only bridge to Bob LearnHNS' existing `Wallet.getNames` path.

## MVP Boundary

- Supports Bob LearnHNS only.
- Does not support legacy Bob Wallet folders in the MVP.
- Does not import seed phrases.
- Does not sign transactions.
- Does not write to Bob LearnHNS app support folders.
- Does not upload wallet/name data.
- Treats locked/encrypted wallets as detected but unreadable until a safe Bob integration path is designed.

## Development

```bash
npm install
npm start
```

Run the read-only scanner without opening Electron:

```bash
npm run scan
```

## Public Repo Safety

This repo is open source. Do not commit local scan output, wallet paths with private evidence, API keys, wallet tokens, exported portfolio files, or screenshots containing private holdings unless they are intentionally redacted.

See [docs/SAFETY.md](docs/SAFETY.md).
