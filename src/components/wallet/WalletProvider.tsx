'use client';

import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import type { Networks } from '@creit.tech/stellar-wallets-kit/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

/** SEP-43's standard signing-callback shape — also exactly what
 * @stellar/stellar-sdk/contract's Client.from expects for its
 * `signTransaction` option, so this can be passed straight through with
 * no adapter at every contract-call site. */
export type WalletSignTransaction = (
  xdr: string,
  opts?: {
    networkPassphrase?: string;
    address?: string;
    submit?: boolean;
    submitUrl?: string;
  },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

/** SEP-53 generic message signing (distinct from signTransaction, which
 * signs a Stellar transaction envelope). The wallet applies the
 * "Stellar Signed Message:\n" prefix and SHA256 hashing itself before
 * signing — callers just pass the plain message string. */
export type WalletSignMessage = (message: string) => Promise<string>;

export type WalletOption = { id: string; name: string; url: string };
type SupportedWalletInfo = WalletOption & { isAvailable: boolean };

type WalletContextValue = {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: WalletSignTransaction;
  signMessage: WalletSignMessage;
  /** Populated instead of opening the kit's wallet-selection modal when
   * connect() finds no supported wallet extension installed — each entry
   * links to where that wallet can be installed. Null otherwise, including
   * after dismissNoWalletPrompt() or a later successful connect(). */
  noWalletOptions: WalletOption[] | null;
  dismissNoWalletPrompt: () => void;
  /** True once a connected wallet reports a network passphrase that doesn't
   * match NETWORK_PASSPHRASE — signing will still open, but the resulting
   * transaction is built for the wrong network and fails on submission. */
  networkMismatch: boolean;
};

/** Not every wallet supports SEP-43's getNetwork() (e.g. some wallets that
 * only ever operate on one fixed network don't implement it) — treat that
 * as "can't tell", not as a mismatch. */
async function walletNetworkMismatch(): Promise<boolean> {
  try {
    const { networkPassphrase } = await StellarWalletsKit.getNetwork();
    return networkPassphrase !== NETWORK_PASSPHRASE;
  } catch {
    return false;
  }
}

/** The kit's authModal() rejects with a plain `{ code, message }` object (not
 * an Error) when the user closes the modal, so both shapes are read. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return '';
}

/** Closing the wallet modal (or declining in the wallet) is a choice, not a
 * failure — it shouldn't produce an error toast. */
function isUserDismissal(err: unknown): boolean {
  return /closed the modal|modal (was )?closed|user (closed|cancel|reject|declin|denied)|dismiss|cancel/i.test(
    errorMessage(err),
  );
}

const WalletContext = createContext<WalletContextValue | null>(null);

let kitInitialized = false;

/** Idempotent — safe to call from every consumer's effect. Only ever runs
 * client-side (this whole file is 'use client', and callers only reach it
 * from useEffect), since the kit touches the DOM/window. */
function ensureKitInitialized(): void {
  if (kitInitialized) return;
  // Without an explicit network the kit defaults to mainnet, and the
  // wallet then refuses every request with "the requester expects you to
  // sign this message on Main Net". The Networks enum's values are the
  // passphrases themselves, so the env var drives this directly.
  StellarWalletsKit.init({
    modules: defaultModules(),
    network: NETWORK_PASSPHRASE as Networks,
  });
  kitInitialized = true;
}

/**
 * Provides wallet state (`address`, `connecting`) and wallet actions
 * (`connect`, `disconnect`, `signTransaction`, `signMessage`) to the app via
 * `useWallet()`. Mount this once near the root of the app.
 *
 * ## Connection lifecycle
 *
 * 1. **Mount / page load.** On mount, the provider lazily initializes the
 *    underlying `StellarWalletsKit` (once per page, via
 *    `ensureKitInitialized`) and calls `getAddress()` to silently restore a
 *    session the user already authorized in a previous visit — the wallet
 *    extension keeps its own authorization state independent of this app.
 *    If nothing is authorized, `getAddress()` rejects and `address` simply
 *    stays `null`; this is the expected steady state for a first-time
 *    visitor, not an error. `connecting` is true during this restore phase,
 *    so UI can show a loading state instead of flashing a disconnected state.
 * 2. **User-initiated connect.** Calling `connect()` sets `connecting: true`,
 *    opens the wallet-selection auth modal, and on success sets `address`.
 *    `connecting` is always reset to `false` in a `finally`. `connect()`
 *    never rejects: closing the modal without picking a wallet is a silent
 *    no-op, and any other failure is surfaced as an error toast, so callers
 *    can fire `void connect()` without a catch.
 *    A restored session also runs the network check, and while connected the
 *    check is repeated each time the window regains focus.
 * 3. **Connected.** While `address` is set, `signTransaction` and
 *    `signMessage` are usable; both throw synchronously (as a rejected
 *    promise) if called with no address available.
 * 4. **Disconnect.** `disconnect()` only clears local `address` state. The
 *    underlying wallet extension has no app-callable disconnect as of
 *    writing, so it stays authorized; calling `connect()` again after
 *    `disconnect()` re-opens the auth modal rather than silently
 *    re-restoring the old session.
 *
 * Feature code that needs a wallet should read `address`/`connecting` from
 * `useWallet()` and treat `address === null` as "not connected" regardless
 * of which lifecycle step produced it — there's no separate "restoring"
 * state exposed today.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [noWalletOptions, setNoWalletOptions] = useState<WalletOption[] | null>(null);
  const { showToast } = useToast();

  const dismissNoWalletPrompt = useCallback(() => setNoWalletOptions(null), []);

  useEffect(() => {
    ensureKitInitialized();

    // Restores an already-authorized session on page load/refresh.
    // getAddress() throws when nothing's connected yet — that's the
    // expected, common case, not an error worth surfacing.
    let cancelled = false;
    StellarWalletsKit.getAddress()
      .then(async ({ address }) => {
        if (cancelled) return;
        setAddress(address);
        // connect() isn't involved on a restore, so the network has to be
        // checked here or the "Wrong network" hint is lost on every reload.
        const mismatch = await walletNetworkMismatch();
        if (!cancelled) setNetworkMismatch(mismatch);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConnecting(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // A wallet can switch network while this tab is in the background, with
  // no event the kit exposes — so re-check whenever the window regains focus.
  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    function handleFocus() {
      void walletNetworkMismatch().then((mismatch) => {
        if (!cancelled) setNetworkMismatch(mismatch);
      });
    }

    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, [address]);

  const connect = useCallback(async () => {
    ensureKitInitialized();
    setConnecting(true);
    try {
      // Checked up front, rather than letting the kit open its own
      // wallet-selection modal: with nothing installed, that modal has
      // nothing to list and no next step. getSupportedWallets() reports
      // each module's installed state and an install `url`, so a visitor
      // with no extension gets a prompt pointing at one instead. Cast
      // rather than imported, since this file otherwise only relies on
      // the handful of kit methods it already types above — a missing or
      // renamed method here falls back to opening the modal as before,
      // rather than failing closed.
      const supported = await (
        StellarWalletsKit as unknown as {
          getSupportedWallets: () => Promise<SupportedWalletInfo[]>;
        }
      )
        .getSupportedWallets()
        .catch(() => null);
      if (supported && !supported.some((wallet) => wallet.isAvailable)) {
        setNoWalletOptions(supported.map(({ id, name, url }) => ({ id, name, url })));
        return;
      }
      setNoWalletOptions(null);

      const { address } = await StellarWalletsKit.authModal();
      setAddress(address);
      setNetworkMismatch(await walletNetworkMismatch());
    } catch (err) {
      if (!isUserDismissal(err)) {
        showToast('error', errorMessage(err) || 'Couldn\'t connect your wallet. Please try again.');
      }
    } finally {
      setConnecting(false);
    }
  }, [showToast]);

  const disconnect = useCallback(() => {
    // The kit has no app-callable disconnect as of writing — the wallet
    // extension itself stays authorized. This just forgets the address on
    // our side, which is what "disconnect" means for most dApps anyway.
    setAddress(null);
    setNetworkMismatch(false);
    setNoWalletOptions(null);
  }, []);

  const signTransaction: WalletSignTransaction = useCallback(
    async (xdr, opts) => {
      const signerAddress = opts?.address ?? address;
      if (!signerAddress) {
        throw new Error('No wallet connected');
      }
      return StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE,
        address: signerAddress,
      });
    },
    [address],
  );

  const signMessage: WalletSignMessage = useCallback(
    async (message) => {
      if (!address) {
        throw new Error('No wallet connected');
      }
      // Encoding of `signedMessage` (base64 vs hex) isn't precisely
      // documented — base64 is assumed here for consistency with
      // signTransaction's signedTxXdr. If backend verification ever fails
      // against a real wallet, check this first.
      const { signedMessage } = await StellarWalletsKit.signMessage(message, {
        address,
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      return signedMessage;
    },
    [address],
  );

  const value = useMemo(
    () => ({
      address,
      connecting,
      connect,
      disconnect,
      signTransaction,
      signMessage,
      networkMismatch,
      noWalletOptions,
      dismissNoWalletPrompt,
    }),
    [
      address,
      connecting,
      connect,
      disconnect,
      signTransaction,
      signMessage,
      networkMismatch,
      noWalletOptions,
      dismissNoWalletPrompt,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}
