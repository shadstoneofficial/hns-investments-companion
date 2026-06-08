# HNS Investments v0.1.0

First public prerelease of HNS Investments, a read-only desktop companion and Handshake ecosystem hub.

## Highlights

- Connects to bridge-enabled Bob LearnHNS for automatic Domains, Coins, and Shakedex data.
- Dashboard home screen with clickable summaries for private portfolio tools and public ecosystem tabs.
- Domains screen for Bob LearnHNS names across local wallets plus local Shakedex listing, purchase, and listing-only inventory.
- Search, wallet, length, IDN, emoji, tag, and sortable domain filters.
- Shakedex bought/listed badges and listing-only rows in the Domains table.
- Coins screen with HNS-only wallet balance summaries.
- Wallets screen with wallet-level domain summaries and click-to-filter behavior.
- Attention screen for nearest renewal heights and IDN review.
- Shakedex screen with My Listings, Fills, and Marketplace coming-soon tabs.
- Applications, News, and Funding tabs powered by the public HNS Community Registry.
- News tab aggregates RSS/Atom entries from registry news sources.
- Funding tab aggregates open GitHub issue proposals from registry funding sources such as DWeb Foundation Grants.
- Registry refresh button for Dashboard, Applications, News, and Funding.
- Scan diagnostics for Bob LearnHNS bridge/discovery state.
- Local CSV/JSON exports.
- Local UI settings for selected screen, filters, sorts, and Shakedex sub-tab.

## Safety

- Read-only companion app.
- Uses a local app support manifest with connection details from Bob LearnHNS.
- Does not sign transactions.
- Does not import seed phrases, mnemonics, private keys, or wallet tokens.
- Does not write to Bob LearnHNS app support folders.
- Does not upload wallet/name data.
- Public Applications, News, and Funding screens fetch public registry/feed data only.
- USD values are not shown by default.

## macOS Release Verification

This prerelease includes signed, notarized, stapled, and Gatekeeper-verified macOS DMGs for Apple Silicon and Intel Macs. Windows and Linux builds are also included for internal testing.

Included assets:

- `HNS-Investments-0.1.0-arm64.dmg`
- `HNS-Investments-0.1.0-x64.dmg`
- `HNS-Investments-0.1.0-x64.exe`
- `HNS-Investments-0.1.0-x86_64.AppImage`
- `SHA256SUMS.txt`

## Notes

This is an early prerelease for testing with Bob LearnHNS bridge support and public HNS Community Registry integration. Use it with non-sensitive review workflows first and report any connection or display issues before relying on it for regular portfolio review.
