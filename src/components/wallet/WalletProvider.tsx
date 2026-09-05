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

type WalletContextValue = {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string, opts: { networkPassphrase: string }) => Promise<string>;
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

  const signTransaction = useCallback(
    async (xdr: string, opts: { networkPassphrase: string }): Promise<string> => {
      if (!address) {
        throw new Error('No wallet connected');
      }
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: opts.networkPassphrase,
        address,
      });
      return signedTxXdr;
    },
    [address],
  );

  const value = useMemo(
    () => ({ address, connecting, connect, disconnect, signTransaction }),
    [address, connecting, connect, disconnect, signTransaction],
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
