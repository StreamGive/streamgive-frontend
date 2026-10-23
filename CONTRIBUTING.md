# Contributing to streamgive-frontend

Thanks for helping out. This guide covers the setup steps specific to this
repo. For the full contribution workflow (branching, PR conventions, design
decisions) see the
[StreamGive docs site](https://github.com/streamgive/streamgive-docs).

## Local setup

```bash
cp .env.example .env          # fill in any blank vars — see ENVIRONMENT.md
npm install
npm run dev                  # starts on http://localhost:3001
```

The app expects a running `streamgive-backend` instance at
`NEXT_PUBLIC_API_URL` (default `http://localhost:3000`). Contract IDs and
the Soroban RPC URL are pre-filled with testnet values so you can start
without deploying contracts yourself.

## Testing

```bash
npm test             # unit + component tests (vitest, single run)
npm run test:coverage  # same, plus a coverage summary (@vitest/coverage-v8)
npm run test:e2e     # end-to-end tests (Playwright)
```

`npm test` runs Vitest once (no watch mode) against every `*.test.ts`/
`*.test.tsx` file in `src/`. Config lives in `vitest.config.ts`, which sets
the `jsdom` environment, the `@` path alias (mirroring `tsconfig.json`), and
`test/setup.ts` as a global setup file — that file wires up `jest-dom`'s
matchers and runs Testing Library's `cleanup()` after every test so DOM
state doesn't leak between tests in the same file (this project doesn't use
Vitest's `globals: true`, so that cleanup isn't automatic).

`npm run test:coverage` runs the same suite with V8 coverage instrumentation
on and prints a per-file table plus an overall summary to the terminal —
useful for spotting code a change left untested before opening a PR. It
isn't a CI gate (no minimum threshold is enforced), just a local signal.

`npm run test:e2e` runs the Playwright specs in `e2e/`. It starts
`npm run dev` for you and points at `http://localhost:3001` unless you set
`E2E_BASE_URL` to an already-running instance (see `playwright.config.ts`).

### Automated accessibility checks

Install the dependencies and Chromium, then run the axe scans:

```bash
npm install
npx playwright install chromium
npm run test:a11y
```

`e2e/accessibility.spec.ts` scans the landing, NGO explorer, impact and donate
pages in both light and dark mode (eight checks). These checks also run as
part of `npm run test:e2e`. They scan the entire page using axe's default
rules, including color contrast, and fail on any reported violation. Full
scan results are attached to each test as `axe-results` JSON.

Start the backend at the app's configured `NEXT_PUBLIC_API_URL` and ensure
it contains at least one verified NGO with a working profile endpoint.
The donate check selects a verified NGO from the explorer and scans the
page with the wallet disconnected; no wallet extension or transaction is
needed. Checks wait for populated content and fail if it cannot load.
Playwright starts the frontend automatically, or you can set `E2E_BASE_URL`
to an already-running frontend as described above.

### Writing a new test

- **Unit/component tests** are colocated with the code they cover, e.g.
  `src/lib/format.ts` → `src/lib/format.test.ts`, and
  `src/components/dashboard/StreamControls.tsx` →
  `src/components/dashboard/StreamControls.test.tsx`. Use
  `@testing-library/react` for components (render, query by role/label,
  fire events) and plain Vitest (`describe`/`it`/`expect`) for pure
  functions. Follow an existing test in the same directory for the
  surrounding conventions (mocking, fixtures, etc).
- **E2E tests** go in `e2e/*.spec.ts` and use Playwright's `test`/`expect`.
  Reserve these for flows that cross multiple pages or need a real browser
  (wallet connection, full donor/NGO flows) — prefer a unit/component test
  when one will do, since the e2e suite is slower and needs a live server.

### Mocking wallets, contract clients, and toasts

For component tests, mock `useWallet`, the contract client hook, and
`useToast` at their module boundaries. This avoids wallet extensions,
Soroban RPC calls, and real toast timers. Return stable mock functions and
reset their behavior in `beforeEach` so cases stay independent. For example,
this `.test.tsx` file exercises the withdrawal confirmation flow:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { WithdrawButton } from '@/components/ngoAdmin/WithdrawButton';
import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useDonationVaultClient } from '@/lib/donationVaultClient';

vi.mock('@/components/wallet/WalletProvider', () => ({ useWallet: vi.fn() }));
vi.mock('@/components/toast/ToastProvider', () => ({ useToast: vi.fn() }));
vi.mock('@/lib/donationVaultClient', () => ({ useDonationVaultClient: vi.fn() }));

const showToast = vi.fn();
const signAndSend = vi.fn();
const withdraw = vi.fn();
const pendingAccrual = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useWallet).mockReturnValue({
    address: 'G' + 'N'.repeat(55),
    connecting: false,
    networkMismatch: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
  });
  vi.mocked(useToast).mockReturnValue({ showToast });
  pendingAccrual.mockResolvedValue({ result: 25_000_000n });
  signAndSend.mockResolvedValue({});
  withdraw.mockResolvedValue({ signAndSend, built: { fee: '100' } });
  vi.mocked(useDonationVaultClient).mockReturnValue({
    client: { withdraw, pending_accrual: pendingAccrual } as never,
    ready: true,
  });
});

it('confirms a withdrawal and reports success', async () => {
  const user = userEvent.setup();
  const onWithdrawn = vi.fn();
  render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);

  await user.click(screen.getByRole('button', { name: 'Withdraw' }));
  await user.click(await screen.findByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(onWithdrawn).toHaveBeenCalledOnce());
  expect(pendingAccrual).toHaveBeenCalledWith({ stream_id: 1n });
  expect(withdraw).toHaveBeenCalledWith({ stream_id: 1n });
  expect(signAndSend).toHaveBeenCalledOnce();
  expect(showToast).toHaveBeenCalledWith(
    'success',
    expect.stringContaining('Withdrawal submitted'),
    undefined,
  );
});
```

Contract methods resolve to an assembled transaction: read-only calls expose
`result`; writes expose an async `signAndSend()`, with an optional `built.fee`
for fee estimates. `create_stream` can resolve `signAndSend()` with
`{ result: 42n }` to supply the new stream ID. Use bigint arguments, matching
the signatures in `src/lib/contractTypes.ts`. The `as never` cast above is
limited to the partial client fixture: it omits SDK members the component
does not use.

For registry consumers, use the same pattern with `useNgoRegistryClient`
from `@/lib/ngoRegistryClient`. Add this module mock and configure the hook
in `beforeEach` (alongside the wallet and toast mocks above):

```tsx
import { useNgoRegistryClient } from '@/lib/ngoRegistryClient';

vi.mock('@/lib/ngoRegistryClient', () => ({ useNgoRegistryClient: vi.fn() }));

const register = vi.fn();

beforeEach(() => {
  register.mockReset().mockResolvedValue({ signAndSend });
  vi.mocked(useNgoRegistryClient).mockReturnValue({
    client: { register } as never,
    ready: true,
  });
});
```

Provide `approve_ngo` or `revoke_ngo` instead of `register` for admin flows.
Mock the hook the component imports; mocking only `getNgoRegistryClient`
does not replace `useNgoRegistryClient`.

To cover loading, return `{ client: null, ready: false }`. To cover a
disconnected or wrong-network wallet, override the default wallet with
`address: null` or `networkMismatch: true`. To simulate a rejected signature,
use `signAndSend.mockRejectedValueOnce(new Error('User declined access'))`;
to simulate a contract-call failure, reject the method mock instead.

Mocking `useToast` supplies the context without mounting `ToastProvider`;
assert on `showToast(type, message, optionalAction)`. When testing visible
toast behavior itself, leave that module unmocked and wrap the component in
the real `ToastProvider` instead. See
`src/components/ngoAdmin/WithdrawButton.test.tsx` and
`src/app/platform-admin/page.test.tsx` for fuller vault and registry examples.
Provider and client-hook tests exercise a different boundary: see
`src/components/wallet/WalletProvider.test.tsx` and
`src/lib/donationVaultClient.test.tsx` for mocking the wallet kit and SDK.

## Linting and formatting

```bash
npm run lint        # ESLint
npm run format      # Prettier check
npm run typecheck   # tsc --noEmit
```

Run all three locally and fix any errors before opening a PR. CI runs lint
and typecheck, plus `npm test`, `npm run build`, and the navigation-only
Playwright spec `e2e/donor-flow.spec.ts`. The Prettier check (`npm run format`)
is a local contributor check; it does not currently run in CI.

## Accessibility checklist

This project has already had a pass of accessibility fixes (color contrast,
live regions for toasts, accessible names on icon-only buttons). When adding
or changing interactive UI, check the following before opening a PR so we
don't regress it:

- **Icon-only controls have an accessible name.** A button with only an
  `<svg>`/icon child needs `aria-label` (see
  `src/components/wallet/ConnectWalletButton.tsx` and
  `src/components/layout/Header.tsx`'s menu toggle). Purely decorative
  icons next to visible text should be `aria-hidden="true"` instead, so
  screen readers don't announce them redundantly.
- **Disclosure widgets expose their state.** A toggle that shows/hides
  content (menus, dropdowns, expandable sections) needs `aria-expanded`,
  and should point `aria-controls` at the id of the region it toggles —
  see `Header.tsx`'s mobile nav toggle.
- **Async status updates use a live region**, not just a visual change —
  toasts, inline form errors, loading/success states. Use
  `role="status"` for non-urgent updates and `role="alert"` for errors
  that need immediate attention (see `src/components/toast/ToastProvider.tsx`).
- **Form controls have a label.** Every `<input>`/`<select>`/`<textarea>`
  needs an associated `<label>` or an `aria-label` when a visible label
  isn't in the design (see the duration `<select>` in
  `src/components/dashboard/StreamControls.tsx`).
- **Color contrast** meets WCAG AA (4.5:1 for body text, 3:1 for large
  text and UI components) — check new text/background color pairs
  against a contrast checker, particularly for muted/secondary text.
- **Everything reachable is keyboard-operable.** Tab to every new
  interactive element, confirm focus is visible, and confirm it can be
  activated with Enter/Space (or Escape to dismiss, for modals/menus)
  without a mouse.
- **Interactive elements are real elements.** Use `<button>`/`<a>` rather
  than a `<div onClick>` — this gets keyboard support, focus, and role
  semantics for free instead of having to re-implement them.
