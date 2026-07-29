# HNS Investments v0.1.3

Public prerelease of HNS Investments, a read-only desktop companion and Handshake ecosystem hub.

Source update: local release-prep commit for v0.1.3, based on feature commit `58110b3` (`Add local domain tagging and filters`).

## Changes

- Adds editable local tags for domains.
- Adds cross-wallet domain filtering by local tag.
- Stores domain tags locally on the user's device, outside Bob wallet data.
- Includes local tags in CSV and JSON exports for review and backup workflows.
- Keeps the v0.1.2 registry, dashboard, Applications, News, Funding, Domains, Coins, Wallets, Attention, Shakedex, export, and diagnostics functionality.

## Not Included Yet

- CSV import/restore for local domain tags is not implemented in this release.

## Safety

- Read-only companion app.
- Uses a local app support manifest with connection details from Bob LearnHNS.
- Does not sign transactions.
- Does not import seed phrases, mnemonics, private keys, or wallet tokens.
- Does not write to Bob LearnHNS app support folders.
- Does not upload wallet/name data.
- Local domain tags stay on the user's device unless the user exports CSV or JSON files.
- Public Applications, News, and Funding screens fetch public registry/feed data only.
- USD values are not shown by default.

## Release Verification

This prerelease is intended to include signed, notarized, stapled, and Gatekeeper-verified macOS DMGs for Apple Silicon and Intel Macs. Windows and Linux builds may be added from the matching pushed source/tag after approval.

Expected assets:

- `HNS-Investments-0.1.3-arm64.dmg`
- `HNS-Investments-0.1.3-x64.dmg`
- `HNS-Investments-0.1.3-x64.exe`
- `HNS-Investments-0.1.3-x86_64.AppImage`
- `SHA256SUMS.txt`

## Notes

This is an early prerelease for testing local domain tagging with Bob LearnHNS bridge support and public HNS Community Registry integration. Use it with non-sensitive review workflows first and report any connection, display, export, or tag persistence issues before relying on it for regular portfolio review.
