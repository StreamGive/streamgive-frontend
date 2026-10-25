# Wallet support and verification

The app initializes `StellarWalletsKit` with `defaultModules()` from
`@creit.tech/stellar-wallets-kit` 2.6.0 (the version pinned by the lockfile).
The names below are adapters offered by that default list; their inclusion is
not a claim that every wallet has been verified against StreamGive.

## Default wallet adapters

| Wallet adapter | Real transaction signature tested here? | Real message signature tested here? |
| --- | --- | --- |
| Albedo | No | No |
| Freighter | No | No |
| Fordefi | No | No |
| Rabet | No | No |
| xBull | No | No |
| Lobstr | No | No |
| Hana | No | No |
| Klever | No | No |
| OneKey | No | No |
| Bitget | No | No |
| CactusLink | No | No |
| dCent | No | No |
| Scopuly | No | No |

## What the app tests

`WalletProvider.test.tsx` mocks the wallet kit. It verifies the shared
SEP-53 `signMessage` wrapper passes the connected address and configured
network and returns the mocked signature; it does not contact a real wallet.
Connection tests provide a mocked available Freighter entry so the shared
connect flow proceeds to the mocked auth modal; this is not a Freighter
compatibility test. There is currently no direct app test of
`signTransaction` and no recorded real-extension signing test for any adapter.
`adminApi.test.ts` also uses a mocked signing callback.

Do not present these mock tests as per-wallet compatibility certification.
Before claiming a wallet is verified, record its app/browser and extension
version, network, transaction flow, SEP-53 message flow (if supported), and
result in a follow-up to this matrix.

## Known limitations

- The provider treats a failed `getNetwork()` call as “network cannot be
  determined,” not as a mismatch. A successful connection therefore does not
  prove that every wallet is on the expected network.
- Some fixed-network wallets do not accept the requested address or network
  options. Confirm the wallet's active account and network before signing.
- `signMessage` currently assumes the kit's returned `signedMessage` encoding
  is base64. The provider documents this as an assumption; verify it against a
  real wallet before changing backend signature verification.

See [WalletProvider](../src/components/wallet/WalletProvider.tsx),
[transaction flows](CONTRACT_CALLS.md), and [admin message authentication](ADMIN_AUTH.md)
for the app-side implementation.
