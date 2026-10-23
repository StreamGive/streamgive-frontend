# StreamGive — Frontend

Donor and NGO web app for StreamGive, a recurring/streaming donation
platform for verified NGOs on Stellar.

## Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS
- Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`) for wallet connection and signing
- Stellar SDK (`@stellar/stellar-sdk`) for Soroban contract calls
- Vitest and Testing Library for unit and component tests
- Playwright for end-to-end tests
- next-intl for i18n (scaffolding so far — see [docs/I18N.md](./docs/I18N.md))

See [docs/COMPONENTS.md](./docs/COMPONENTS.md) for a component tree of
`src/components/` with a one-line description of each piece,
[docs/STATE_ARCHITECTURE.md](./docs/STATE_ARCHITECTURE.md) for the app's
context/state architecture (`WalletProvider`, `ToastProvider`, the
signature cache), and
[docs/CONTRACT_CALLS.md](./docs/CONTRACT_CALLS.md) for a reference mapping
every Soroban contract method the frontend calls to the UI flow and
arguments behind it, and
[docs/THEMING.md](./docs/THEMING.md) for the Tailwind v4 theme tokens and
the dark-mode strategy.

See [docs/DATA_FETCHING.md](./docs/DATA_FETCHING.md) for server/client data
loading, cache revalidation, polling intervals, and the known 1+N impact
fetch pattern, and [docs/I18N.md](./docs/I18N.md) for how translations are
wired up and how to add a language.

## Local development

```
cp .env.example .env
npm install
npm run dev   # http://localhost:3001 — 3000 is taken by streamgive-backend
```

See [ENVIRONMENT.md](./ENVIRONMENT.md) for a full reference of every `NEXT_PUBLIC_*` variable.

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
route exists specifically to be iframed on NGOs' own sites. See
[docs/EMBED.md](./docs/EMBED.md) for the full integration guide (sizing,
security headers, and WordPress/Webflow/plain-HTML examples).

## Authentication

The platform admin panel (`/platform-admin`) has no separate login — it
authenticates by having the connected wallet sign a message per request,
rather than by holding a session cookie or API key.

For each admin request, `adminFetch` in
[`src/lib/adminApi.ts`](./src/lib/adminApi.ts) signs the string
`${method}:${path}:${timestamp}` via `signMessage` (from
[`src/components/wallet/WalletProvider.tsx`](./src/components/wallet/WalletProvider.tsx),
which wraps `StellarWalletsKit.signMessage`) and sends the address,
signature and timestamp as the `x-admin-address`, `x-admin-signature` and
`x-admin-timestamp` headers. The backend's `requireAdminSignature` verifies
the signature was produced by the address configured as `ADMIN_ADDRESS` and
that the timestamp is within its clock-skew window, rejecting anything else
with a 401 — there's no separate allowlist or role table on the frontend
side to keep in sync.

Signing prompts the wallet extension, so `adminApi.ts` caches a signature
per `address:method:path` for a few minutes (`SIGNATURE_REUSE_WINDOW_MS`)
and reuses it across requests instead of prompting on every page visit. A
reused signature that gets rejected (e.g. the server clock has moved past
the reuse window) triggers exactly one retry with a freshly signed message.

Because authorization is entirely signature-based, only the wallet holding
the private key for `ADMIN_ADDRESS` can act on `/platform-admin` — there is
no separate admin account or password to provision or rotate.

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
  [Deployment](#deployment)), so changing `.env` requires a dev-server restart
  (or a rebuild, in Docker) to take effect.
- A CORS error in the console usually means the backend isn't configured
  to allow this app's origin — that's a backend-side fix, not frontend.

**Contract calls failing (donations, withdrawals, NGO registry)**
- `NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID` and
  `NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID` are pre-filled in `.env.example`
  with testnet deployment IDs. If you change networks or deploy your own
  contracts, update them in `.env` using the matching entries in
  `streamgive-contracts/deployments.json`.
- `NEXT_PUBLIC_SOROBAN_RPC_URL` must point at an RPC endpoint for that
  same network; a mismatched network/RPC/contract-ID combination
  typically fails with an XDR or "contract not found" style error rather
  than a clear message.

**Env changes not taking effect**
Next.js inlines `NEXT_PUBLIC_*` vars at build time. Restart `npm run dev`
after editing `.env`; in Docker, rebuild the image rather than swapping
`--env-file` on an existing image.

**Impact page feels slow / makes a lot of requests**
The `/impact` page polls every 20 seconds instead of receiving live updates
(there's no websocket/SSE push from the backend), and each poll is an N+1
fetch — it lists every verified NGO, then fetches each NGO's profile
individually and sums the totals client-side, because the backend has no
platform-wide aggregate endpoint. That's `1 + N` requests per poll, where
`N` is the NGO count. This is known tech debt; see the comment above
`POLL_INTERVAL_MS` in `src/app/impact/page.tsx` and the docblock on
`loadPlatformImpact` in `src/lib/impact.ts` for details, and fix candidates
if you're picking this up (a real backend aggregate endpoint, or at least a
longer interval / backoff).

## Related repositories

- [streamgive-contracts](https://github.com/streamgive/streamgive-contracts) — Soroban smart contracts
- [streamgive-backend](https://github.com/streamgive/streamgive-backend) — indexer & API
- [streamgive-docs](https://github.com/streamgive/streamgive-docs) — documentation

## Routes

This table lists every route under `src/app`, who it is meant for, and its technical requirements.

| Route | Audience | Wallet / Admin Required? | Component / Route Type |
|---|---|---|---|
| `/` | Public | No | Server Component |
| `/apply` | NGO Applicant | Yes (Wallet) | Client Component |
| `/dashboard` | Donor | Yes (Wallet) | Client Component |
| `/embed/[ngoId]` | Embed Consumer (iframe) | No | Server Component |
| `/impact` | Public / Donor / NGO | No | Client Component |
| `/ngo-admin` | NGO Admin | Yes (Wallet) | Client Component |
| `/ngos` | Public | No | Server Component |
| `/ngos/[id]` | Public | No | Server Component |
| `/ngos/[id]/donate` | Donor | No (Form requires Wallet) | Server Component |
| `/ngos/[id]/donate/success` | Donor | No | Server Component |
| `/platform-admin` | Platform Admin | Yes (Wallet + `ADMIN_ADDRESS`) | Client Component |
| `/robots.txt` | Search crawlers | No | Metadata Route (`src/app/robots.ts`) |
| `/sitemap.xml` | Search crawlers | No | Metadata Route (`src/app/sitemap.ts`) |

See the [Embed Widget Guide](./docs/EMBED.md) for details on embedding the `/embed/[ngoId]` widget.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the accessibility checklist to
run through before adding new interactive UI.

## Status

Early development.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
