# ADR-0003: Use the backend for indexed reads and Soroban for contract actions

- **Status:** Accepted
- **Date:** 2026-10-26 (recorded)
- **Decision owners:** StreamGive maintainers

## Context

The backend indexes NGO and stream data for public views. Contract state changes
must be authorized by the wallet and confirmed on Soroban; the indexer can lag
behind a confirmed transaction.

## Decision

Use the backend HTTP API for public and indexed application data. Build and
simulate contract calls with the Soroban clients, then request wallet
signatures for state-changing calls. Keep wallet signing behind `WalletProvider`.

## Consequences

An immediate indexed read may be stale after a transaction; mutation flows must
not treat that lag as a failed on-chain action. Keep method signatures and
signer requirements in [CONTRACT_CALLS.md](../CONTRACT_CALLS.md), and the read
refresh policy in [DATA_FETCHING.md](../DATA_FETCHING.md).
