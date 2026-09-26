# Contributing to streamgive-frontend

Thanks for helping out. This guide covers the setup steps specific to this
repo. For the full contribution workflow (branching, PR conventions, design
decisions) see the
[StreamGive docs site](https://github.com/streamgive/streamgive-docs).

## Local setup

```bash
cp .env.example .env.local   # fill in any blank vars — see ENVIRONMENT.md
npm install
npm run dev                  # starts on http://localhost:3001
```

The app expects a running `streamgive-backend` instance at
`NEXT_PUBLIC_API_URL` (default `http://localhost:3000`). Contract IDs and
the Soroban RPC URL are pre-filled with testnet values so you can start
without deploying contracts yourself.

## Running the tests

```bash
npm test           # unit + component tests (vitest, single run)
npm run test:e2e   # end-to-end tests (Playwright — needs a running dev server)
```

## Linting and formatting

```bash
npm run lint        # ESLint
npm run format      # Prettier check
npm run typecheck   # tsc --noEmit
```

All three run in CI — fix any errors before opening a PR.

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
