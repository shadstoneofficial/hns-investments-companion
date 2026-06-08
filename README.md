# HNS Investments Companion

HNS Investments Companion is a local-first Electron app for power users who manage many Handshake TLDs, HNS balances, and Shakedex activity in Bob LearnHNS.

The first milestone is intentionally read-only: Bob LearnHNS remains the wallet and action surface, while HNS Investments gives a unified operations view without mutating Bob wallet data.

Current status: the app detects Bob LearnHNS and uses the HNS Investments read-only bridge when a bridge-enabled Bob LearnHNS build is running.

## Current Screens

- Domains: owned names plus local Shakedex inventory from Bob LearnHNS, with search, wallet, length, IDN, emoji, tag filters, bought/listed Shakedex indicators, and sortable columns.
- Coins: HNS-only wallet balances by wallet, with spendable, confirmed, unconfirmed, locked, and status columns. USD is not shown.
- Wallets: wallet-level domain summaries. Click a wallet row to filter Domains.
- Attention: nearest renewal heights and IDN review.
- Shakedex: local My Listings and Fills tabs from the Bob LearnHNS bridge. Marketplace discovery is planned but not active.
- Scan: local bridge and filesystem diagnostics.
- Exports: local CSV/JSON export.

## MVP Boundary

- Supports Bob LearnHNS only.
- Does not support legacy Bob Wallet folders in the MVP.
- Does not import seed phrases.
- Does not sign transactions.
- Does not write to Bob LearnHNS app support folders.
- Does not upload wallet/name data.
- Does not query public marketplace or chain APIs unless that future feature is explicitly added as opt-in.
- Treats locked/encrypted wallets as detected but unreadable until a safe Bob integration path is designed.

## Local Settings

The app stores UI preferences in Electron/browser local storage, including selected screen, filters, sort direction, and Shakedex sub-tab. These settings are local app metadata and are not meant to be committed.

## Development

```bash
npm install
npm start
```

Run the read-only scanner without opening Electron:

```bash
npm run scan
```

Build a local unsigned macOS app and DMG:

```bash
npm run package-mac
```

For public macOS release signing and notarization, see [docs/RELEASE.md](docs/RELEASE.md).

## Public Repo Safety

This repo is open source. Do not commit local scan output, wallet paths with private evidence, API keys, wallet tokens, exported portfolio files, or screenshots containing private holdings unless they are intentionally redacted.

See [docs/SAFETY.md](docs/SAFETY.md).
