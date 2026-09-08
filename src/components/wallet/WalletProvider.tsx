'use client';

import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** SEP-43's standard signing-callback shape — also exactly what
 * @stellar/stellar-sdk/contract's Client.from expects for its
 * `signTransaction` option, so this can be passed straight through with
 * no adapter at every contract-call site. */
export type WalletSignTransaction = (
  xdr: string,
  opts: { networkPassphrase: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

/** SEP-53 generic message signing (distinct from signTransaction, which
 * signs a Stellar transaction envelope). The wallet applies the
 * "Stellar Signed Message:\n" prefix and SHA256 hashing itself before
 * signing — callers just pass the plain message string. */
export type WalletSignMessage = (message: string) => Promise<string>;

type WalletContextValue = {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: WalletSignTransaction;
  signMessage: WalletSignMessage;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let kitInitialized = false;

/** Idempotent — safe to call from every consumer's effect. Only ever runs
 * client-side (this whole file is 'use client', and callers only reach it
 * from useEffect), since the kit touches the DOM/window. */
function ensureKitInitialized(): void {
  if (kitInitialized) return;
  StellarWalletsKit.init({ modules: defaultModules() });
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
 *    visitor, not an error. `connecting` is NOT set during this restore —
 *    it's a synchronous-feeling background check, not a user-initiated
 *    action — so UI that gates on `connecting` alone won't reflect this
 *    step. Consumers that need to distinguish "still restoring" from
 *    "confirmed disconnected" should treat `address === null` as
 *    ambiguous until they have another signal (e.g. their own effect
 *    completing).
 * 2. **User-initiated connect.** Calling `connect()` sets `connecting: true`,
 *    opens the wallet-selection auth modal, and on success sets `address`.
 *    `connecting` is always reset to `false` in a `finally`, including when
 *    the user closes the modal without picking a wallet or the modal
 *    throws — callers should surface that rejection themselves if they want
 *    user-facing error feedback, since `WalletProvider` does not.
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
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    ensureKitInitialized();

    // Restores an already-authorized session on page load/refresh.
    // getAddress() throws when nothing's connected yet — that's the
    // expected, common case, not an error worth surfacing.
    StellarWalletsKit.getAddress()
      .then(({ address }) => setAddress(address))
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    ensureKitInitialized();
    setConnecting(true);
    try {
      const { address } = await StellarWalletsKit.authModal();
      setAddress(address);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // The kit has no app-callable disconnect as of writing — the wallet
    // extension itself stays authorized. This just forgets the address on
    // our side, which is what "disconnect" means for most dApps anyway.
    setAddress(null);
  }, []);

  const signTransaction: WalletSignTransaction = useCallback(
    async (xdr, opts) => {
      const signerAddress = opts.address ?? address;
      if (!signerAddress) {
        throw new Error('No wallet connected');
      }
      return StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: opts.networkPassphrase,
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
      const { signedMessage } = await StellarWalletsKit.signMessage(message, { address });
      return signedMessage;
    },
    [address],
  );

  const value = useMemo(
    () => ({ address, connecting, connect, disconnect, signTransaction, signMessage }),
    [address, connecting, connect, disconnect, signTransaction, signMessage],
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
