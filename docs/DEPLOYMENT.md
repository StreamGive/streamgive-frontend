# Deployment guide

Step-by-step instructions for deploying this app to Vercel or via the
provided `Dockerfile`, plus a full reference of every `NEXT_PUBLIC_*`
variable the app needs and when it needs it. See
[ENVIRONMENT.md](../ENVIRONMENT.md) for the day-to-day local-dev version of
this reference, and the README's [Deployment](../README.md#deployment)
section for the short version.

## Build time vs. runtime: there isn't a runtime set

Every environment variable this app reads is prefixed `NEXT_PUBLIC_`, and
Next.js inlines **every** `NEXT_PUBLIC_*` reference — in client components,
server components, and middleware alike — into the compiled output at `next
build`. There is currently no server-only (non-`NEXT_PUBLIC_`) secret and no
value read fresh from `process.env` at request time. In other words: for
this app, every variable below is a **build-time** value. Setting or
changing one after the build has already run has no effect until the app is
rebuilt — only *how* you trigger that rebuild differs between the two
platforms covered here:

- **Vercel** rebuilds the app itself on every deploy, so changing a project
  env var just means triggering a redeploy (Vercel does this automatically
  on a git push, or you can click "Redeploy" in the dashboard).
- **Docker** does not rebuild anything on its own. The values have to be
  passed as `--build-arg`s to `docker build`, and changing any of them
  means rebuilding the image — passing a new value to `docker run` (via
  `-e` or `--env-file`) on an already-built image does nothing.

If a future change adds a genuine server-only secret (no `NEXT_PUBLIC_`
prefix), it would be read at request time instead, set directly in the
Vercel project's env vars or passed to `docker run` — not baked in at build
time. None of the variables below are like that today.

## Variable reference

| Variable | Required | Default / testnet value | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3000` | Base URL of the `streamgive-backend` API. Point this at your staging/production API. Also read by `src/middleware.ts` to allowlist it in the CSP's `connect-src`. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3001` | The app's own origin. Used as a server-render fallback (`robots.ts`, `sitemap.ts`, the root layout's metadata) and as the SSR fallback for the embed snippet/QR code before the browser's real origin is available. Set it to the deployed domain for correct SEO metadata. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint for on-chain reads and contract calls. Must match the network of the contract IDs below. Also read by `src/middleware.ts` to allowlist it in the CSP's `connect-src`. |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Stellar network passphrase. Use `Public Global Stellar Network ; September 2015` for mainnet — this also flips `IS_MAINNET`/`NETWORK_NAME` in `src/lib/stellar.ts`, which controls whether the testnet warning banner shows. |
| `NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID` | **Yes** | *(testnet value pre-filled)* | Soroban contract ID of the deployed `DonationVault` contract. Current value: `streamgive-contracts/deployments.json`. |
| `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID` | **Yes** | *(testnet value pre-filled)* | Soroban contract ID of the deployed `NgoRegistry` contract. Current value: `streamgive-contracts/deployments.json`. |
| `NEXT_PUBLIC_USDC_ISSUER` | No | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (testnet) | Stellar account of Circle's USDC issuer. The USDC token contract address is derived from this. Switch to the mainnet issuer when moving networks. |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | No | *(unset)* | The wallet address allowed into `/platform-admin`. Purely cosmetic — it only decides whether the header shows the "Platform Admin" link; the backend independently verifies every admin request against its own `ADMIN_ADDRESS`. Leave unset and the link simply never appears. Must match the backend's `ADMIN_ADDRESS` for the link to show for the right wallet. |

"Required" above means the app is missing core functionality without it
(donations/registry calls fail), not that a build errors without it.

All contract-ID/network variables
(`NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_NETWORK_PASSPHRASE`,
`NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID`, `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID`,
`NEXT_PUBLIC_USDC_ISSUER`) must refer to the same Stellar network. A
mismatch typically shows up as an XDR decode error or a "contract not
found" failure rather than a clear message.

## Deploying to Vercel

Vercel is the simpler path — it builds and runs the app itself, with no
Dockerfile involved.

1. **Import the repo.** From the Vercel dashboard, "Add New… → Project",
   then select this repository. Vercel auto-detects Next.js; the default
   build command (`next build`) and output settings are correct as-is —
   `next.config.ts` skips the `standalone` output specifically when
   `VERCEL` is set, since Vercel's own build pipeline expects the default
   layout.
2. **Set the environment variables.** In the project's Settings →
   Environment Variables, add each variable from the
   [reference above](#variable-reference) that you need to override from
   its testnet default (at minimum, the two contract IDs if you're not
   using the testnet deployment). Vercel lets you scope each one per
   environment (Production / Preview / Development) — e.g. point Preview
   deployments at a staging backend and Production at the real one.
3. **Deploy.** Push to the connected branch, or click "Deploy" in the
   dashboard. Vercel builds and serves the app; no further configuration
   is needed for the security headers or the `/embed/*` CSP exemption —
   `src/middleware.ts` runs the same way on Vercel's Edge Runtime as it
   does anywhere else.
4. **Changed a variable?** Trigger a new deployment (a git push, or
   "Redeploy" in the dashboard) — see [Build time vs.
   runtime](#build-time-vs-runtime-there-isnt-a-runtime-set) above for why
   this step is required.

## Deploying with Docker

Use this for self-hosting anywhere that can run a container. The
`Dockerfile` is a two-stage build: a `build` stage that compiles the app
with full `node_modules`, and a minimal `runtime` stage that only ships
Next's `standalone` output (self-contained server, not the full
dependency tree) running as a non-root user.

1. **Build the image**, passing every `NEXT_PUBLIC_*` value you need to
   override as a `--build-arg` — the `Dockerfile` declares one `ARG` per
   variable in the [reference above](#variable-reference), so any you
   omit fall back to whatever's hardcoded as that variable's default in
   the source (not the `.env.example` defaults, since `.env` is never
   copied into the image — see `.dockerignore`):

   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
     --build-arg NEXT_PUBLIC_APP_URL=https://give.example.com \
     --build-arg NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org \
     --build-arg NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
     --build-arg NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID=CDLKBGX3VTFZZBVBNQYHF47PQO6I7UTBYVVQE3BPJDONF6G4U33Z7VLH \
     --build-arg NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID=CCPWQBI7FV2CZ7EECOVZ5XHOHK5S7CS6XTBDWPWHBEOKPTIASNGOBQFH \
     --build-arg NEXT_PUBLIC_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
     --build-arg NEXT_PUBLIC_ADMIN_ADDRESS=GABCDEF... \
     -t streamgive-frontend .
   ```

   Values shown above are the testnet defaults from `.env.example` — fill
   in your own backend URL, app URL and (if applicable) admin address.
   `NEXT_PUBLIC_ADMIN_ADDRESS` can be omitted entirely if the deployment
   has no platform admin wallet to show the link for.

2. **Run the container.** `--env-file`/`-e` here only matter for anything
   read at runtime — today, nothing is, so this just publishes the port:

   ```bash
   docker run -p 3001:3001 streamgive-frontend
   ```

3. **Changed a variable?** Rebuild the image with the new `--build-arg`
   values and redeploy the new image — an already-built image cannot pick
   up a different value for any of these by any other means.

Either platform: `/embed/*` is exempt from the `X-Frame-Options: DENY`
header the app sets everywhere else, since that route is meant to be
iframed on an NGO's own site. See [docs/EMBED.md](./EMBED.md) for the full
embedding guide.
