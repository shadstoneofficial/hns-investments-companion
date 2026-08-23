# HNS Investments v0.1.4

Public prerelease of HNS Investments, the read-only Bob LearnHNS portfolio companion and Handshake ecosystem hub.

## Balance fixes

- Correctly distinguishes Bob's spendable, confirmed, unconfirmed, and locked HNS balances.
- Stops treating confirmed balance as spendable when coins are locked in auctions or covenants.
- Stops double-counting confirmed and current locked balance views.
- Adds prominent portfolio aggregates for Spendable now, Total confirmed, and Currently locked.
- Changes the dashboard Coins total to the aggregate amount currently spendable across Bob wallets.

## Other changes since v0.1.3

- Adds optional encrypted GFAVIP cloud synchronization for approved domain metadata and tags.
- Keeps cloud synchronization disabled by default and supports local-only use.
- Hardens GFAVIP Wallet SSO state handling and documents the production rollout.

## Safety and privacy

- HNS Investments remains a read-only companion and cannot sign or broadcast transactions.
- It does not import seed phrases, private keys, or wallet passwords.
- Bob wallet balances, owner hashes, bridge credentials, and signing access are excluded from cloud synchronization.
- Optional cloud synchronization requires explicit user pairing and scope selection.

## Verification

- The balance fix was validated against real Bob wallets: spendable and confirmed matched within 0.01 HNS, locked balances reconciled, all aggregates matched, and refresh height/timestamps advanced.
- Automated Bob and HNS Investments regression suites passed before release preparation.
- Release assets must pass signing, Apple notarization, stapling, Gatekeeper, checksum, launch, and bridge-refresh checks before publication.

Expected assets:

- `HNS-Investments-0.1.4-arm64.dmg`
- `HNS-Investments-0.1.4-x64.dmg`
- `HNS-Investments-0.1.4-x64.exe`
- `HNS-Investments-0.1.4-x86_64.AppImage`
- macOS, Windows, and Linux checksum manifests
