# App state & context architecture

The app keeps almost all state local to the component that owns it
(`useState` in the page/component that renders it — see `CreateStreamForm.tsx`,
`StreamControls.tsx`, `WithdrawButton.tsx`). Two pieces of state don't fit
that pattern because many unrelated components need them at once, so they
live in React context instead, plus one plain in-memory cache that isn't
context at all. This is a map of those three, for contributors deciding
where a new piece of state belongs.

## `WalletProvider` (`src/components/wallet/WalletProvider.tsx`)

Wraps `StellarWalletsKit` and exposes the connected wallet's state and
actions via the `useWallet()` hook:

| Field             | Type                    | Description                                                                                                                                           |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `address`         | `string \| null`        | The connected wallet's public key, or `null` if nothing is connected.                                                                                 |
| `connecting`      | `boolean`               | `true` during the initial session restore and while a user-initiated `connect()` call is in flight.                                                    |
| `connect()`       | `() => Promise<void>`   | Opens the wallet-selection auth modal; sets `address` on success.                                                                                     |
| `disconnect()`    | `() => void`            | Clears local `address` state only — the wallet extension itself stays authorized (see the file's docblock for why there's no true remote disconnect). |
| `signTransaction` | `WalletSignTransaction` | Signs a Stellar transaction envelope; used by the contract clients (see [CONTRACT_CALLS.md](./CONTRACT_CALLS.md)).                                    |
| `signMessage`     | `WalletSignMessage`     | SEP-53 message signing; used by `adminApi.ts` (see [ADMIN_AUTH.md](./ADMIN_AUTH.md)).                                                                 |
| `networkMismatch` | `boolean`               | `true` once a connected wallet reports a network passphrase that doesn't match `NETWORK_PASSPHRASE`.                                                  |

**Mount once, near the root** — it's a single provider for the whole app,
not per-page.

**Connecting vs. restoring.** On mount, `WalletProvider` silently calls
`StellarWalletsKit.getAddress()` to restore a session the user already
authorized on a previous visit. `connecting` starts as `true` and remains
true throughout this restore, including the network check after a
successful `getAddress()`. The restore's `finally` resets it to `false`
whether a session was restored or no authorized wallet was found. On
success, `address` is set to the restored public key; otherwise it stays
`null`. An explicit `connect()` call also sets `connecting` to `true` and
resets it to `false` in its own `finally`.

Pages should show a loading state while `address === null && connecting`,
then show a connect prompt only when `address === null && !connecting`.
This prevents a disconnected-state flash while an existing session is
restoring. `ConnectWalletPrompt` handles this loading state internally,
so pages can render it whenever `address` is missing. `ConnectWalletButton`
also shows a loading state while `connecting` is true. The flag lets UI
distinguish a pending connection from a confirmed disconnected state; it
does not distinguish automatic restoration from an explicit connection.

**Usage:**

```tsx
const { address, connecting, connect, disconnect } = useWallet();
```

Throws if called outside a `WalletProvider` — there's no default/fallback
context value, so a missing provider fails fast instead of silently
no-opping.

## `ToastProvider` (`src/components/toast/ToastProvider.tsx`)

Renders transient success/error/info notifications and exposes a single
action via the `useToast()` hook:

| Field                      | Type                                                              | Description                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `showToast(type, message)` | `(type: 'success' \| 'error' \| 'info', message: string) => void` | Queues a toast; it auto-dismisses after 5s (`TOAST_DURATION_MS`) unless hovered/focused, which pauses the timer until the mouse/focus leaves. |

Toast state (the visible list) is internal to the provider — consumers
only ever call `showToast`, they never read the toast list itself.
Accessibility-wise, error toasts render with `role="alert"` (interrupts
screen readers) and success/info render with `role="status"` (announced
without interrupting).

**Usage:**

```tsx
const { showToast } = useToast();
showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
```

Also throws outside a `ToastProvider`, for the same fail-fast reason as
`useWallet()`.

## Signature cache (`src/lib/adminApi.ts`) — not a context

The admin API's per-request SEP-53 signing (see
[ADMIN_AUTH.md](./ADMIN_AUTH.md) for the full scheme) uses a **module-level
`Map`** (`signatureCache`), not React state or context:

- It's read/written entirely inside `adminApi.ts` — no component reads or
  subscribes to it directly, so there's nothing to re-render on change and
  no reason to route it through context.
- It's deliberately **in-memory only**: it survives client-side navigation
  (module state persists across route changes in a Next.js SPA
  navigation) but resets on a full page reload or tab close. That's a
  conscious choice, not an oversight — nothing sensitive should outlive
  the tab.
- Keyed by `` `${address}:${method}:${path}` ``, so switching wallets or
  hitting a different admin endpoint never reuses a stale signature for
  the wrong signer/request.

If a future admin feature needs to read cache contents from a component
(e.g. showing "cached" vs. "fresh" in the UI), that's a sign it should
move into `WalletProvider` or a new context rather than staying a private
module variable — nothing about it is architecturally required to stay
private today, it's just that no consumer has needed it yet.

## Where new shared state should go

- **Needed by one component/page only** → local `useState`, same as
  `CreateStreamForm`, `StreamControls`, `WithdrawButton`.
- **Needed by many unrelated components, changes over the session, and UI
  should re-render on change** → a new React context, following the
  `WalletProvider`/`ToastProvider` pattern (a `createContext` + a
  `useXyz()` hook that throws outside its provider).
- **Needed by one module's internal logic only, nothing renders from it
  directly** → a module-level variable/cache, following the signature
  cache's pattern — but revisit this if a component ever needs to read it.
