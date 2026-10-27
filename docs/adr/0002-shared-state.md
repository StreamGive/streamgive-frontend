# ADR-0002: Keep state local unless it is shared across the app

- **Status:** Accepted
- **Date:** 2026-10-26 (recorded)
- **Decision owners:** StreamGive maintainers

## Context

Most UI state has one owner. Wallet session state and transient notifications
are needed by unrelated components, while the admin signature cache is only
used inside one module.

## Decision

Keep feature state in the page or component that owns it. Use the root
`WalletProvider` and `ToastProvider` contexts only for cross-cutting state and
actions. Keep module-private caches out of React context unless components
need to observe them.

## Consequences

Consumers share one wallet and toast state, while feature-only changes do not
rerender unrelated parts of the app. Context hooks fail fast outside their
provider. The signature cache remains in memory and is not persisted. See
[STATE_ARCHITECTURE.md](../STATE_ARCHITECTURE.md).
