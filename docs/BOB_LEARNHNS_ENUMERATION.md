# Bob LearnHNS Name Enumeration Notes

Date: 2026-06-07

## Finding

Bob LearnHNS already has a read path for owned names:

- `app/background/wallet/service.js` exposes `getNames`.
- `app/background/wallet/client.js` includes `getNames` in the Wallet IPC client.
- `app/ducks/myDomains.js` calls `walletClient.getNames()` and then checks each owner coin with `walletClient.getCoin(owner.hash, owner.index)`.
- `app/pages/DomainManager/index.js` renders the resulting name list and handles search/sort/export UX.

This strongly suggests HNS Investments should integrate through a Bob LearnHNS API or helper process modeled on `Wallet.getNames`, rather than scraping wallet databases directly.

## MVP App Behavior

The current HNS Investments scanner only performs filesystem metadata discovery:

- detects the Bob LearnHNS app support folder;
- detects candidate `hsd_data` folders;
- detects wallet storage directories as metadata-only hints;
- marks wallets as detected but not enumerated.

It intentionally does not read raw wallet DB records or request wallet secrets.

## Next Implementation Path

Preferred next step:

1. Add a Bob LearnHNS read-only export/API surface that returns the same safe name data used by Domain Manager.
2. Include wallet id, account, name state, owner outpoint, renewal height, and expiration fields.
3. Have HNS Investments call that read-only surface for unlocked wallets.
4. Show locked/encrypted wallets as detected but unreadable.

Avoid:

- direct wallet database scraping;
- reading or displaying API keys;
- unlocking wallets from HNS Investments in the first real portfolio build;
- sending detected names to public-chain APIs without opt-in.

