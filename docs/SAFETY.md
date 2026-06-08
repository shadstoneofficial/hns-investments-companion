# Safety Model

HNS Investments Companion starts read-only because Bob LearnHNS contains wallet material and private portfolio state.

## Current Rules

- The app may read filesystem metadata inside the Bob LearnHNS app support folder.
- The app may detect candidate `hsd_data` folders.
- The app may report that wallet data exists but is locked, encrypted, unsupported, or not yet enumerable.
- The app may read names, Shakedex summaries, and HNS-only wallet balance summaries from the Bob LearnHNS read-only bridge.
- The app must not write to Bob LearnHNS folders.
- The app must not display or export API keys, wallet tokens, seeds, mnemonics, private keys, or raw wallet database contents.
- The app must not expose raw UTXOs, raw wallet database records, addresses, or transaction graph data in the first balance bridge.
- The app must not send portfolio data to public APIs in the MVP.

## Locked Or Encrypted Wallets

For the MVP, locked or encrypted Bob LearnHNS wallets should be shown as detected but unreadable.

Future versions may add a safe unlock path, but the preferred integration is to let Bob LearnHNS remain the wallet authority and use explicit Bob APIs or deep links for sensitive actions.

## Bob Variants

The MVP supports only Bob LearnHNS.

Other local Bob-family folders may be detected so the user understands why they are not indexed, but they should remain unsupported until the product decision changes.

## Public-Chain Verification

Public-chain verification means checking a detected name against an external chain source or hosted indexer. That can leak which names are in a user's local portfolio.

For that reason, public-chain verification is not part of the first scanner. It should be opt-in and clearly labeled before any names leave the machine.
