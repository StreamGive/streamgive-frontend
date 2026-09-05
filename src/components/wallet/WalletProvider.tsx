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
