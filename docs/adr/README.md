# Architecture Decision Records

These records explain the reasoning behind architectural choices that shape
multiple routes or features. Detailed implementation behavior remains in the
linked reference documents; update both when a decision changes.

## Accepted decisions

- [0001 — Server-render public content; keep wallet flows in the browser](0001-rendering-boundaries.md)
- [0002 — Keep state local unless it is shared across the app](0002-shared-state.md)
- [0003 — Use the backend for indexed reads and Soroban for contract actions](0003-read-and-transaction-boundaries.md)

Use the [template](0000-template.md) for new records. Number records in order;
do not reuse a number after a decision is superseded.
