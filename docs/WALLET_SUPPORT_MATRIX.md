# Wallet support matrix

StreamGive connects wallets through `@creit.tech/stellar-wallets-kit` (pinned
at 2.6.0), using the kit's `defaultModules()` list. This page records which
wallets that list includes and what has actually been tested.

"Tested" here means what the repository's automated tests cover. The unit tests
mock the kit (see `src/components/wallet/WalletProvider.test.tsx`), so they
exercise StreamGive's own connect, sign and error handling, not a real wallet.
No wallet below has been verified end to end for signing in this repository.

| Wallet | Type | Connect | Transaction signing | Message signing (SEP-53) | Known limitations |
| --- | --- | --- | --- | --- | --- |
| Albedo | Web (popup) | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Freighter | Browser extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Fordefi | Institutional / extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Rabet | Browser extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| xBull | Browser extension / web | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| LOBSTR | Mobile / extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Hana | Browser extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Klever | Browser extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| OneKey | Browser extension / hardware | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Bitget | Browser extension / mobile | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| CactusLink | Browser extension | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| D'CENT | Hardware | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |
| Scopuly | Web | Mocked only | Not verified | Not verified | Included by `defaultModules()`; real-wallet behaviour untested here. |

## Notes

- The app passes the wallet network passphrase from
  `NEXT_PUBLIC_NETWORK_PASSPHRASE` (testnet by default) to every signing call.
  A wallet set to another network shows a "Wrong network" badge.
- Message signing depends on each wallet implementing the kit's `signMessage`.
  A wallet that does not support it surfaces an error from the kit.
- Only wallets returned by `defaultModules()` are offered. Wallets that need
  extra configuration or polyfills are not listed.
- Connection problems: see [WALLET_TROUBLESHOOTING](./WALLET_TROUBLESHOOTING.md).

## Updating this page

When a wallet is tested with a real signing flow, change its row from "Not
verified" to what was tested (version, network, date) and note any limits.
