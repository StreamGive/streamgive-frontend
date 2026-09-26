# Environment variables

Copy `.env.example` to `.env.local` and fill in any blank values before
starting the dev server. All variables are prefixed `NEXT_PUBLIC_` because
Next.js inlines them at build time — they are embedded in the client bundle
and are **not secret**. Never put credentials or private keys here.

| Variable | Required | Default (from `.env.example`) | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:3000` | Base URL of the `streamgive-backend` API. Change this to point at staging or production when deploying. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Yes | `https://soroban-testnet.stellar.org` | Stellar Soroban RPC endpoint used for all on-chain reads and contract calls. Must match the network of the deployed contracts. |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Yes | `Test SDF Network ; September 2015` | Stellar network passphrase. Use `Public Global Stellar Network ; September 2015` for mainnet. |
| `NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID` | Yes | *(testnet value pre-filled)* | Soroban contract ID of the deployed `DonationVault` contract. Find the current value in `streamgive-contracts/deployments.json`. |
| `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID` | Yes | *(testnet value pre-filled)* | Soroban contract ID of the deployed `NgoRegistry` contract. Find the current value in `streamgive-contracts/deployments.json`. |
| `NEXT_PUBLIC_USDC_ISSUER` | Yes | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (testnet) | Stellar account address of Circle's USDC issuer. The USDC token contract address is derived from this value at runtime — switch to the mainnet issuer address when moving to production. |

## Notes

- **Build-time inlining.** `NEXT_PUBLIC_*` vars are read once when `next
  build` (or `next dev`) runs and baked into the JS bundle. Changing them
  in `.env.local` requires a dev-server restart; in Docker, rebuild the
  image — passing `--env-file` at `docker run` alone has no effect on
  already-inlined values.
- **No secrets here.** Contract IDs and RPC URLs are all public
  identifiers. If you ever need a server-side secret (e.g. an admin API
  key), use a variable without the `NEXT_PUBLIC_` prefix so Next.js keeps
  it server-side only and out of the browser bundle.
- **Network consistency.** `NEXT_PUBLIC_SOROBAN_RPC_URL`,
  `NEXT_PUBLIC_NETWORK_PASSPHRASE`, `NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID`,
  `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID`, and `NEXT_PUBLIC_USDC_ISSUER`
  must all refer to the same Stellar network. A mismatch typically
  produces XDR decode errors or "contract not found" failures that can be
  hard to diagnose.
