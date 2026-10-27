# Loading, empty and error states

Every page that fetches data can be in one of four states, and each one
should look and read the same way across the app. This guide is the
reference for new pages; it is derived from the patterns already used in
`src/app/**/page.tsx` and `src/components/`.

## The four states

| State | When | What the user sees |
| --- | --- | --- |
| **Loading** | A request is in flight and there is no data to show yet. | A skeleton matching the final layout, or a short `role="status"` line. |
| **Empty** | The request succeeded, but there is nothing to show (no records, or no matches for a filter). | A neutral sentence explaining why, plus a next step when one exists. |
| **Error** | The request failed and there is no data to fall back on. | What failed, a short reassurance, and a **Retry** / **Try again** action. |
| **Stale / partial** | Data loaded before, but a refresh or poll failed. | Keep the last good data and show an amber `role="status"` notice. |

Do not collapse empty and error into one message. "Nothing here yet" and
"we couldn't load this" need different actions from the user.

## Loading

Prefer a layout-shaped skeleton when the page has a predictable structure.
Use `RouteLoading` for route-level `loading.tsx` boundaries, `NgoCardSkeleton`
for card grids, and a skeleton block for stat strips (see
`src/app/impact/page.tsx`).

- Announce progress with `role="status"`, and keep the visible state calm.
- Hide decorative skeletons from assistive tech with `aria-hidden="true"`.
- For inline fetches, a single muted line is enough: `Loading…` /
  `Loading your streams…` in `text-gray-500 dark:text-gray-400`.
- Never show the empty state before the first request settles; start
  `loading` as `true` when a fetch begins on mount.
- Do not flash a skeleton on background polls. Only show loading when the
  user is waiting for content they do not already have.

```tsx
{
  loading && (
    <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
      Loading your streams…
    </p>
  );
}
```

Route boundary:

```tsx
// src/app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <RouteLoading title="Your donations" />;
}
```

## Empty

Empty states are neutral, sentence case, and explain the next step. No
exclamation marks, no "Oops", no blame.

- Name what is missing, then how to fix it.
- Link the action when there is one (`Explore NGOs`, `Apply here`).
- Distinguish "nothing yet" from "nothing matches":
  - `No verified NGOs yet.`
  - `You haven't started any streams yet. Explore NGOs.`
  - `No NGOs match "…".`
  - `No streams match stream ID "…".`
  - `No active streams found.`

```tsx
{
  !loading && !loadError && streams.length === 0 && (
    <p className="mt-8 text-gray-600 dark:text-gray-400">
      You haven&apos;t started any streams yet.{' '}
      <Link href="/ngos" className="underline">
        Explore NGOs
      </Link>
      .
    </p>
  );
}
```

```tsx
{
  filteredNgos.length === 0 ? (
    <p className="mt-8 text-gray-600 dark:text-gray-400">
      No NGOs match &quot;{searchQuery.trim()}&quot;.
    </p>
  ) : (
    /* list */
  );
}
```

## Error

Use the smallest surface that covers the failure:

- **Route-level failure** (the page cannot render at all): let the route's
  `error.tsx` render `RouteError`, which shows **Something went wrong**,
  **We hit an unexpected issue.**, the optional error digest, and a
  **Try again** button calling `reset()`.
- **Data failure inside a working page** (the page chrome is fine): render
  an inline message and a **Retry** button that re-runs the fetch.
- **Action failure** (a form submit or contract call): show a toast with
  `showToast('error', …)` and keep the form usable; the toast provider
  renders error toasts with `role="alert"`.
- **Refresh/poll failure with data already on screen**: keep the data and
  show `Couldn't refresh — showing the last numbers we loaded.` in amber
  with `role="status"`.

Inline error wording follows one shape: **what failed + what to do next**.

- `Couldn't load your streams. Please check your connection and try again.`
- `Couldn't load your NGO data. Please check your connection and try again.`
- `Couldn't load the NGO list. Please check your connection and try again.`
- `Couldn't load platform stats. Please check your connection and try again.`

```tsx
{
  !loading &&
    loadError &&
    streams.length === 0 && (
      <div className="mt-8">
        <p className="text-red-600 dark:text-red-400">
          Couldn&apos;t load your streams. Please check your connection and try again.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    );
}
```

```tsx
{
  loadError && impact && (
    <p role="status" className="mt-8 text-sm text-amber-700 dark:text-amber-400">
      Couldn&apos;t refresh — showing the last numbers we loaded.
    </p>
  );
}
```

### Error copy rules

- Say "couldn't", not "failed to" or "error occurred".
- Do not expose raw error messages, status codes or stack traces; use
  `error.digest` only as a reference when the route boundary provides it.
- Do not blame the user ("invalid input", "you did that wrong").
- Use "Retry" for re-running a fetch and "Try again" for the full-page
  recovery action; keep those two labels consistent.
- Log the error for developers (`console.error` in the boundary), but the
  user-facing text stays generic.

## Not found is not an error

A missing record or unknown route is a **not-found** state, not a load
failure. Use `src/app/not-found.tsx` for unknown routes and a page-specific
sentence for a missing item (`Page not found`, `We couldn't find what you
were looking for.`). Do not show **Try again** for a 404 — retrying cannot
fix it.

## State precedence

Render in this order and stop at the first match:

1. **Loading** — and there is no data yet.
2. **Error** — and there is no data to show.
3. **Empty** — the request succeeded with no records.
4. **Content**.
5. **Stale notice** — alongside content when a later refresh failed.

Wallet-gated pages add one state before all of these: if there is no
`address`, render `ConnectWalletPrompt` with a page-specific message
(`Connect your wallet to see your streams.`). While the wallet session is
being restored, `ConnectWalletPrompt` itself shows `Loading…`.

```tsx
{
  !address && <ConnectWalletPrompt message="Connect your wallet to see your streams." />;
}
{
  address && loading && <LoadingLine />;
}
{
  address && !loading && loadError && streams.length === 0 && <ErrorBlock onRetry={refresh} />;
}
{
  address && !loading && !loadError && streams.length === 0 && <EmptyState />;
}
{
  address && !loading && streams.length > 0 && <StreamList />;
}
```

## Accessibility

The project's accessibility checklist in [`CONTRIBUTING.md`](../CONTRIBUTING.md)
applies to every state:

- Loading regions use `role="status"` (non-urgent announcement); skeleton
  blocks stay `aria-hidden="true"` so they are not read as content.
- Inline load failures are plain text plus a real `<button>`; if the error
  appears after an action and needs immediate attention, render it with
  `role="alert"` (toasts already do this).
- Do not rely on colour alone: error text also says what happened.
- Keep the retry control keyboard-reachable and focus-visible.
- Do not move focus on every poll; only move it when a user-initiated
  retry replaces the error state with the loading state.

## Checklist for a new page

- [ ] Does it have a route-level `loading.tsx` using `RouteLoading` (or a
      shape-matched skeleton)?
- [ ] Does it have a route-level `error.tsx` using `RouteError`, with a
      `subject` that names the page content?
- [ ] Does the first fetch start with `loading = true`, so the empty state
      never flashes?
- [ ] Are loading, error, empty and content states mutually exclusive?
- [ ] Does the empty state explain why and link the next step?
- [ ] Does the inline error say what failed and offer **Retry**?
- [ ] Do background refreshes keep the last good data and show the amber
      stale notice instead of an error page?
- [ ] Are loading regions `role="status"` and errors announced with
      `role="alert"` where appropriate?
- [ ] Is the wording sentence case, contraction-friendly, and free of
      blame or raw error text?
