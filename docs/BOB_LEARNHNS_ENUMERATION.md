# Bob LearnHNS Name Enumeration Notes

Date: 2026-06-07

## Finding

Bob LearnHNS already has a read path for owned names:

- `app/background/wallet/service.js` exposes `getNames`.
- `app/background/wallet/client.js` includes `getNames` in the Wallet IPC client.
- `app/ducks/myDomains.js` calls `walletClient.getNames()` and then checks each owner coin with `walletClient.getCoin(owner.hash, owner.index)`.
- `app/pages/DomainManager/index.js` renders the resulting name list and handles search/sort/export UX.

This strongly suggests HNS Investments should integrate through a Bob LearnHNS API or helper process modeled on `Wallet.getNames`, rather than scraping wallet databases directly.

## Current App Behavior

The current HNS Investments scanner performs filesystem metadata discovery and then prefers the Bob LearnHNS read-only bridge when available:

- detects the Bob LearnHNS app support folder;
- detects candidate `hsd_data` folders;
- detects wallet storage directories as metadata-only hints;
- reads owned names from the bridge-backed `Wallet.getNames` path;
- reads Shakedex listing/fill summaries from Bob LearnHNS;
- reads aggregate per-wallet HNS balances from Bob LearnHNS balance APIs.

It intentionally does not read raw wallet DB records, request wallet secrets, expose raw UTXOs, sign transactions, or write to Bob LearnHNS.

## Next Implementation Path

Implemented bridge shape:

1. Bob LearnHNS publishes a local manifest in app support with `baseUrl` and a random bearer token.
2. HNS Investments calls the bridge only when the manifest is present and the token works.
3. `/portfolio` returns the same safe name data used by Bob's Domain Manager path.
4. `/shakedex` returns local listing and fill summaries.
5. `/coins` returns per-wallet HNS balance summaries without raw coin/address detail.
6. HNS Investments falls back to discovery mode when the bridge is unavailable.

Avoid:

- direct wallet database scraping;
- reading or displaying API keys;
- unlocking wallets from HNS Investments in the first real portfolio build;
- sending detected names to public-chain APIs without opt-in.
