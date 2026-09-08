# StreamGive — Frontend

Donor and NGO web app for StreamGive, a recurring/streaming donation
platform for verified NGOs on Stellar.

## Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS

## Local development

```
cp .env.example .env
npm install
npm run dev   # http://localhost:3001 — 3000 is taken by streamgive-backend
```

## Deployment

**Vercel (recommended)** — Next.js's own platform, effectively zero-config:
connect the repo, set the `NEXT_PUBLIC_*` env vars from `.env.example` in
the project settings, deploy. No Dockerfile involved.

**Docker (self-hosting)**:

```
docker build -t streamgive-frontend .
docker run -p 3001:3001 --env-file .env streamgive-frontend
```

The image uses Next's `standalone` output — a minimal self-contained
server, not the full `node_modules` — and runs as a non-root user. Note
that `NEXT_PUBLIC_*` vars are baked in at **build time**, not read at
container startup — rebuild the image after changing any of them, an
`--env-file` at `docker run` alone won't pick up new values.

Either way, `/embed/*` is deliberately exempt from the `X-Frame-Options`
header the app sets everywhere else (see `src/middleware.ts`) — that
route exists specifically to be iframed on NGOs' own sites.

## Troubleshooting

**Port already in use**
`npm run dev` binds to `3001` (`3000` is reserved for `streamgive-backend`).
If `3001` is also taken, stop whatever's holding it or pass a different
port: `npm run dev -- -p 3002`.

**Wallet won't connect**
- Make sure a Stellar wallet extension (e.g. Freighter) is installed and
  unlocked in the browser you're testing with.
- The wallet must be set to the same network the app expects —
  `NEXT_PUBLIC_NETWORK_PASSPHRASE` in `.env` (testnet by default).
- If `connect()` silently fails or hangs, check the browser console —
  `StellarWalletsKit`'s auth modal surfaces most errors there rather than
  in the UI.
- A stale session after switching wallets/accounts usually clears up with
  a hard refresh; the app re-checks `getAddress()` on load.

**API unreachable / requests failing**
- `NEXT_PUBLIC_API_URL` (in `.env`, default `http://localhost:3000`) must
  point at a running `streamgive-backend` instance — this app has no
  API of its own.
- `NEXT_PUBLIC_*` vars are read at build time in production (see
  Deployment below), so changing `.env` requires a dev-server restart
  (or a rebuild, in Docker) to take effect.
- A CORS error in the console usually means the backend isn't configured
  to allow this app's origin — that's a backend-side fix, not frontend.

**Contract calls failing (donations, withdrawals, NGO registry)**
- `NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID` and
  `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID` must be filled in from
  `streamgive-contracts/deployments.json` for the network you're using —
  they're blank in `.env.example`.
- `NEXT_PUBLIC_SOROBAN_RPC_URL` must point at an RPC endpoint for that
  same network; a mismatched network/RPC/contract-ID combination
  typically fails with an XDR or "contract not found" style error rather
  than a clear message.

**Env changes not taking effect**
Next.js inlines `NEXT_PUBLIC_*` vars at build time. Restart `npm run dev`
after editing `.env`; in Docker, rebuild the image rather than swapping
`--env-file` on an existing image.

## Related repositories

- [streamgive-contracts](https://github.com/streamgive/streamgive-contracts) — Soroban smart contracts
- [streamgive-backend](https://github.com/streamgive/streamgive-backend) — indexer & API
- [streamgive-docs](https://github.com/streamgive/streamgive-docs) — documentation

## Status

Early development.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
