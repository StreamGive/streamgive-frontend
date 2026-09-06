'use client';

import { useWallet } from './WalletProvider';

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        title={address}
        aria-label={`Connected as ${address}. Click to disconnect.`}
      >
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={connecting}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
    >
      {connecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
