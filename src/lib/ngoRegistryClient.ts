'use client';

import { Client } from '@stellar/stellar-sdk/contract';
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet, type WalletSignTransaction } from '@/components/wallet/WalletProvider';
import type { NgoRegistryMethods } from './contractTypes';

import { NETWORK_PASSPHRASE, NGO_REGISTRY_CONTRACT_ID, SOROBAN_RPC_URL } from './stellar';

type NgoRegistryClient = Client & NgoRegistryMethods;

/** How long to wait for the Soroban RPC WASM spec fetch inside Client.from()
 * before giving up and surfacing a retry state to the UI. */
const CLIENT_INIT_TIMEOUT_MS = 15_000;

export async function getNgoRegistryClient(
  publicKey: string,
  signTransaction: WalletSignTransaction,
) {
  if (!NGO_REGISTRY_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID is not set');
  }

  // Client.from() fetches the contract's WASM spec from the RPC node and has
  // no built-in timeout. Race it so a slow or unresponsive node doesn't leave
  // the UI stuck on "Preparing contract…" forever.
  const timeoutSignal = AbortSignal.timeout(CLIENT_INIT_TIMEOUT_MS);
  const client = await Promise.race([
    Client.from({
      contractId: NGO_REGISTRY_CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: SOROBAN_RPC_URL,
      publicKey,
      signTransaction,
    }),
    new Promise<never>((_, reject) => {
      timeoutSignal.addEventListener('abort', () =>
        reject(new DOMException('Timed out reaching the NGO registry contract — check your RPC endpoint.', 'TimeoutError')),
      );
    }),
  ]);

  return client as NgoRegistryClient;
}

/** See useDonationVaultClient's comment — same reasoning, for the NGO
 * registry contract. Exposes `initError` and `retryInit` so callers can
 * show a retry button instead of being stuck when Client.from() times out. */
export function useNgoRegistryClient(): {
  client: NgoRegistryClient | null;
  ready: boolean;
  initError: string | null;
  retryInit: () => void;
} {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [client, setClient] = useState<NgoRegistryClient | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  // Bumping this counter triggers a retry attempt from the effect below.
  const [retryCount, setRetryCount] = useState(0);

  const retryInit = useCallback(() => {
    setInitError(null);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!address) {
      // A disconnected wallet must not retain a usable signing client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClient(null);
      setInitError(null);
      return;
    }

    let cancelled = false;
    // Invalidate the previous signer before fetching the new wallet's client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(null);
    setInitError(null);

    getNgoRegistryClient(address, signTransaction)
      .then((c) => {
        if (!cancelled) {
          setClient(c);
          setInitError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // The error can be a developer-facing message (e.g. a missing
          // NEXT_PUBLIC_*_CONTRACT_ID env var) that a visitor can't act on —
          // logged for whoever's debugging the deployment, not shown.
          console.error('Failed to initialize the NGO registry client:', err);
          const message = "Couldn't reach the NGO registry contract. Please try again shortly.";
          setInitError(message);
          showToast('error', message);
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
