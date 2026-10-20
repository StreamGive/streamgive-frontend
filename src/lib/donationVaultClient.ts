'use client';

import { Client } from '@stellar/stellar-sdk/contract';
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet, type WalletSignTransaction } from '@/components/wallet/WalletProvider';
import type { DonationVaultMethods } from './contractTypes';

import { DONATION_VAULT_CONTRACT_ID, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from './stellar';

type DonationVaultClient = Client & DonationVaultMethods;

/** How long to wait for the Soroban RPC WASM spec fetch inside Client.from()
 * before giving up and surfacing a retry state to the UI. */
const CLIENT_INIT_TIMEOUT_MS = 15_000;

/**
 * Builds a fresh client, with no caching at this layer — getSharedDonationVaultClient
 * below is what caches the resulting promise, for the UI's benefit.
 */
export async function getDonationVaultClient(
  publicKey: string,
  signTransaction: WalletSignTransaction,
) {
  if (!DONATION_VAULT_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID is not set');
  }

  // Client.from() fetches the contract's WASM spec from the RPC node and has
  // no built-in timeout. Race it so a slow or unresponsive node doesn't leave
  // the UI stuck on "Preparing contract…" forever.
  const timeoutSignal = AbortSignal.timeout(CLIENT_INIT_TIMEOUT_MS);
  const client = await Promise.race([
    Client.from({
      contractId: DONATION_VAULT_CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: SOROBAN_RPC_URL,
      publicKey,
      signTransaction,
    }),
    new Promise<never>((_, reject) => {
      timeoutSignal.addEventListener('abort', () =>
        reject(new DOMException('Timed out reaching the donation contract — check your RPC endpoint.', 'TimeoutError')),
      );
    }),
  ]);

  return client as DonationVaultClient;
}

// Module-level cache keyed by the signer's address, shared by every
// useDonationVaultClient call in the app — a dashboard page renders one
// StreamControls/WithdrawButton per row, and without this each row's hook
// would run its own Client.from() (a spec fetch over RPC), firing N
// concurrent fetches for N rows (issue #202). Every row awaits the same
// in-flight/resolved promise instead, so only one fetch ever happens per
// signer. `hasToastedInitError` rides alongside it so a failure surfaces as
// one toast, not N identical ones.
let cached: { address: string; promise: Promise<DonationVaultClient> } | null = null;
let hasToastedInitError = false;

function getSharedDonationVaultClient(
  address: string,
  signTransaction: WalletSignTransaction,
): Promise<DonationVaultClient> {
  if (!cached || cached.address !== address) {
    hasToastedInitError = false;
    const promise = getDonationVaultClient(address, signTransaction);
    cached = { address, promise };
    // Don't leave a rejected promise cached — a future render (reconnect,
    // remount) should get to retry the fetch rather than replaying the same
    // failure forever.
    promise.catch(() => {
      if (cached?.promise === promise) {
        cached = null;
      }
    });
  }
  return cached.promise;
}

/**
 * Builds the donation vault client as soon as a wallet is connected, rather
 * than waiting for the first click on a contract-calling button — without
 * this, the WASM spec fetch inside Client.from (a few seconds on a slow
 * connection) would happen *after* the click, and any button that isn't
 * separately guarded would appear clickable, then throw.
 *
 * `ready` is what callers should disable their contract-calling buttons on;
 * `client` is null until then and while the wallet is disconnected.
 * `initError` is set when Client.from() fails or times out — callers can
 * show a retry button that calls `retryInit` to attempt again.
 */
export function useDonationVaultClient(): {
  client: DonationVaultClient | null;
  ready: boolean;
  initError: string | null;
  retryInit: () => void;
} {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [client, setClient] = useState<DonationVaultClient | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  // Bumping this counter triggers a retry attempt from the effect below.
  const [retryCount, setRetryCount] = useState(0);

  const retryInit = useCallback(() => {
    // Clear the rejected promise from the cache so the next attempt gets a
    // fresh Client.from() rather than replaying the same failure.
    cached = null;
    hasToastedInitError = false;
    setInitError(null);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!address) {
      setClient(null);
      setInitError(null);
      return;
    }

    let cancelled = false;
    setClient(null);
    setInitError(null);

    getSharedDonationVaultClient(address, signTransaction)
      .then((c) => {
        if (!cancelled) {
          setClient(c);
          setInitError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? `Couldn't reach the donation contract: ${err.message}`
              : `Couldn't reach the donation contract.`;
          setInitError(message);
          if (!hasToastedInitError) {
            hasToastedInitError = true;
            showToast('error', message);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  // retryCount is intentionally included: incrementing it re-runs the effect
  // to retry the Client.from() call after a failure or timeout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, signTransaction, showToast, retryCount]);

  return { client, ready: client !== null, initError, retryInit };
}
