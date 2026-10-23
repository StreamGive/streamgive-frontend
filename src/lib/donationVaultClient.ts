'use client';

import { Client } from '@stellar/stellar-sdk/contract';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet, type WalletSignTransaction } from '@/components/wallet/WalletProvider';
import type { DonationVaultMethods } from './contractTypes';

import { DONATION_VAULT_CONTRACT_ID, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from './stellar';

type DonationVaultClient = Client & DonationVaultMethods;

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

  const client = await Client.from({
    contractId: DONATION_VAULT_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
    signTransaction,
  });

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
 */
export function useDonationVaultClient(): { client: DonationVaultClient | null; ready: boolean } {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [client, setClient] = useState<DonationVaultClient | null>(null);

  useEffect(() => {
    if (!address) {
      // A disconnected wallet must not retain a usable signing client.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClient(null);
      return;
    }

    let cancelled = false;
    // Invalidate the previous signer before fetching the new wallet's client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(null);

    getSharedDonationVaultClient(address, signTransaction)
      .then((c) => {
        if (!cancelled) {
          setClient(c);
        }
      })
      .catch((err) => {
        if (!cancelled && !hasToastedInitError) {
          hasToastedInitError = true;
          // The error can be a developer-facing message (e.g. a missing
          // NEXT_PUBLIC_*_CONTRACT_ID env var) that a donor can't act on —
          // logged for whoever's debugging the deployment, not shown.
          console.error('Failed to initialize the donation vault client:', err);
          showToast('error', "Couldn't reach the donation contract. Please try again shortly.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, signTransaction, showToast]);

  return { client, ready: client !== null };
}
