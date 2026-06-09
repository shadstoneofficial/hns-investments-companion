# HNS Investments v0.1.2

Public prerelease of HNS Investments, a read-only desktop companion and Handshake ecosystem hub.

Source update: `b536d42` (`Point registry source button to page JSON`).

## Changes

- Registry source buttons now open the relevant page JSON source instead of a broader registry target.
- Keeps the v0.1.1 hub dashboard, Applications, News, Funding, Domains, Coins, Wallets, Attention, Shakedex, export, and diagnostics functionality.

## Safety

- Read-only companion app.
- Uses a local app support manifest with connection details from Bob LearnHNS.
- Does not sign transactions.
- Does not import seed phrases, mnemonics, private keys, or wallet tokens.
- Does not write to Bob LearnHNS app support folders.
- Does not upload wallet/name data.
- Public Applications, News, and Funding screens fetch public registry/feed data only.
- USD values are not shown by default.

## Release Verification

This prerelease includes signed, notarized, stapled, and Gatekeeper-verified macOS DMGs for Apple Silicon and Intel Macs. Windows and Linux builds are included for internal testing.

Included assets:

- `HNS-Investments-0.1.2-arm64.dmg`
- `HNS-Investments-0.1.2-x64.dmg`
- `HNS-Investments-0.1.2-x64.exe`
- `HNS-Investments-0.1.2-x86_64.AppImage`
- `SHA256SUMS.txt`

## Notes

This is an early prerelease for testing with Bob LearnHNS bridge support and public HNS Community Registry integration. Use it with non-sensitive review workflows first and report any connection or display issues before relying on it for regular portfolio review.
