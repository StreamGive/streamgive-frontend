# ADR-0001: Server-render public content; keep wallet flows in the browser

- **Status:** Accepted
- **Date:** 2026-10-26 (recorded)
- **Decision owners:** StreamGive maintainers

## Context

Public NGO pages can be fetched without a user's wallet. Transaction signing,
wallet state, and browser preferences depend on browser APIs and user action.

## Decision

Fetch public NGO profiles and explorer content in Next.js Server Components.
Use Client Components for wallet-dependent views and interactions. Keep
browser-only effects behind the client boundary; do not initialize wallet
extensions during server rendering.

## Consequences

Public content can use server fetch revalidation. Wallet-dependent pages own
their client refresh and loading behavior. Keep the route-by-route policy in
[DATA_FETCHING.md](../DATA_FETCHING.md).
