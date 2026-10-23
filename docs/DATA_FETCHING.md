# Data-fetching strategy

Public NGO content is fetched in Server Components. Wallet-dependent views
fetch in browser effects after the wallet is available; the public impact
page also fetches in the browser to refresh its totals periodically. Client
Components can still have an initial server-rendered shell, but their
effect-driven API data loads in the browser.

The shared HTTP helpers live in [src/lib/api.ts](../src/lib/api.ts) and use
`NEXT_PUBLIC_API_URL` (default `http://localhost:3000`). Signed platform-admin
requests use [src/lib/adminApi.ts](../src/lib/adminApi.ts).

## Rendering and refresh behavior by route

| Route / view | Data-fetching location | Data and refresh policy |
| --- | --- | --- |
| `/` landing stats strip | Server, in [StatsStrip](../src/components/landing/StatsStrip.tsx) | `loadPlatformImpact()`; NGO list and profiles use 30-second server fetch revalidation. No browser polling. |
| `/ngos` | Server, in [the explorer page](../src/app/ngos/page.tsx) | `getNgos()`, then `getNgo()` per NGO, all with 30-second revalidation. The client `NgoExplorer` filters, sorts, and paginates the supplied list locally. |
| `/ngos/[id]` | Server, in [the profile page](../src/app/ngos/[id]/page.tsx) | `getNgo(id)` with 30-second revalidation, plus `getStreams({ ngo: id })` for recent streams with no explicit revalidation option. No browser polling. |
| `/ngos/[id]/donate` | Server page with a client donation form | [The page](../src/app/ngos/[id]/donate/page.tsx) loads `getNgo(id)` with 30-second revalidation. `CreateStreamForm` reads wallet/token state and submits transactions in the browser. |
| `/ngos/[id]/donate/success` | Server, in [the success page](../src/app/ngos/[id]/donate/success/page.tsx) | NGO profile uses 30-second revalidation; a streams fetch checks the supplied stream ID, with no explicit revalidation option. No polling to wait for indexing. |
| `/embed/[ngoId]` | Server page with a client donation form | [The widget page](../src/app/embed/[ngoId]/page.tsx) loads the NGO profile with 30-second revalidation. Wallet and transaction interactions run in the browser. No API polling. |
| `/dashboard` | Client, in [the donor dashboard](../src/app/dashboard/page.tsx) | `getStreams({ donor: address })` on wallet connection/change, after stream actions, and every **30 seconds** while the tab is visible. Polling stops when hidden and refreshes immediately when visible again. |
| `/impact` | Client, in [the impact page](../src/app/impact/page.tsx) | `loadPlatformImpact()` immediately on mount and every **20 seconds**, plus explicit retry. There is no visibility-based pause in this page. |
| `/ngo-admin` | Client, in [the NGO admin page](../src/app/ngo-admin/page.tsx) | `lookupNgoByAddress(address)`, then `getStreams({ ngo: match.id })` for a verified NGO. Runs on wallet connection/change, retry, and after withdrawals. **No timed polling currently.** |
| `/ngo-admin` withdrawal history | Client, in [WithdrawalHistory](../src/components/ngoAdmin/WithdrawalHistory.tsx) | `getWithdrawals(ngoId)` on mount, NGO ID change, or retry. The parent refresh temporarily unmounts this panel, so it fetches again when remounted after a withdrawal. No timer. |
| `/apply` | Client, in [the application page](../src/app/apply/page.tsx) | `getApplicationStatus(address)` on wallet connection/change. Registration and application submission happen on user action. No polling. |
| `/platform-admin` | Client, in [the platform admin page](../src/app/platform-admin/page.tsx) | Fetches signed application lists and the NGO list on wallet/status-filter changes and after review/revoke actions. No polling. |

## Revalidation, polling, and freshness

`getNgos()` and `getNgo()` set `next: { revalidate: 30 }` for server-side
fetches. This is a cache revalidation interval, not a browser refresh timer
or a promise that an already-open page updates every 30 seconds. The same
helpers are also called from Client Components; their `next` option does
not create a browser-side Next.js data cache or refresh scheduler.

Streams, address lookups, withdrawal history, and application-status helpers
have no explicit Next.js revalidation option. Their callers decide when to
fetch. Dashboard balances also update locally every **1 second** using the
last stream balance, rate, and timestamp; this is an estimate and makes no
network request. Dashboard and NGO explorer sorting, filtering, and
pagination use the already-fetched lists rather than requesting individual
result pages from the backend.

Transactions go through the Soroban clients rather than the HTTP read API.
The backend indexer can lag behind a confirmed transaction, so an immediate
HTTP refresh may still return older values. Dashboard top-ups and
cancellations apply optimistic local updates before refreshing; subsequent
API results replace them. Rate modification fetches the donor's stream list
again immediately before computing the new rate. See
[CONTRACT_CALLS.md](./CONTRACT_CALLS.md) for the transaction flows.

## Known 1+N fetch in platform impact

[loadPlatformImpact](../src/lib/impact.ts) is shared by the landing stats
strip and `/impact`. Each invocation:

1. Fetches the NGO list once with `getNgos()` (`GET /ngos`).
2. Fetches every returned NGO's profile concurrently with `getNgo(id)`
   (`GET /ngos/:id`) using `Promise.allSettled`.
3. Sums committed amounts, withdrawn amounts, and active stream counts.

For N NGOs, that is **1 + N fetch calls** per invocation. On the landing
page the calls run on the server and can use the 30-second fetch cache. On
`/impact`, each open page repeats 1 + N browser requests every 20 seconds,
as well as on initial load and retry. With 100 NGOs, one page makes 101
requests per refresh. `/ngos` separately uses the same list-plus-profiles
pattern to populate its cards.

There is no platform-wide aggregate endpoint or websocket/SSE subscription
in this flow. A backend aggregate endpoint would remove the per-NGO fan-out;
longer intervals or backoff could reduce polling load. These are possible
improvements, not current behavior.

Failed or missing individual profiles are skipped, so totals can be partial
while `ngoCount` still reflects the full list length. Donor counts are not
summed because one donor can support multiple NGOs. If the initial list
request fails, the loader rejects: the landing strip hides itself, while
`/impact` shows an error and retry. If a later impact refresh fails, the
page keeps its last successful totals and displays a stale-data notice.

## Request lifecycle and failures

The helpers in `api.ts` impose a **10-second timeout**. Helpers accepting a
caller `AbortSignal` combine it with that timeout. `getNgo()` returns `null`
for a genuine 404 and throws for other unsuccessful responses.

Dashboard, NGO admin, and platform admin use
[useLatestRequest](../src/lib/useLatestRequest.ts) to supersede older
refreshes and check that a response is still current before setting state.
This also guards helpers that do not accept the caller's signal. Dashboard
and NGO admin clear data belonging to a previous wallet when the address
changes. Impact and withdrawal history use effect cleanup guards and abort
controllers. Impact clears its interval and aborts its latest refresh on
cleanup; it does not use the shared latest-request guard.

Keep these rendering boundaries, intervals, and failure behavior in sync
with the source when changing a fetch path.
