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

## Related repositories

- [streamgive-contracts](https://github.com/streamgive/streamgive-contracts) — Soroban smart contracts
- [streamgive-backend](https://github.com/streamgive/streamgive-backend) — indexer & API
- [streamgive-docs](https://github.com/streamgive/streamgive-docs) — documentation

## Status

Early development.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
