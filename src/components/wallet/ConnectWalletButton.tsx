'use client';

import { truncateAddress } from '@/lib/format';
import { NETWORK_NAME } from '@/lib/stellar';

import { useWallet } from './WalletProvider';

export function ConnectWalletButton() {
  const {
    address,
    connecting,
    connect,
    disconnect,
    networkMismatch,
    noWalletOptions,
    dismissNoWalletPrompt,
  } = useWallet();

  if (address) {
    return (
      <span className="flex items-center gap-2">
        {networkMismatch && (
          <span
            role="alert"
            title={`Your wallet is on a different network. Switch it to ${NETWORK_NAME} before making transactions.`}
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            Wrong network
          </span>
        )}
        <button
          type="button"
          onClick={disconnect}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:hover:bg-gray-800 dark:focus-visible:ring-teal-400"
          title={address}
          aria-label={`Connected as ${address}. Click to disconnect.`}
        >
          {truncateAddress(address)}
        </button>
      </span>
    );
  }

  if (connecting) {
    return (
      <span className="flex items-center text-sm text-gray-500 dark:text-gray-400 px-4 py-2">
        <svg className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
        Connecting…
      </span>
    );
  }

  if (noWalletOptions) {
    return (
      <span className="relative inline-block">
        <button
          type="button"
          onClick={() => void connect()}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:focus-visible:ring-teal-400"
        >
          Connect Wallet
        </button>
        <div
          role="status"
          className="absolute right-0 top-full z-10 mt-2 w-64 rounded-md border border-gray-200 bg-white p-4 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="font-medium text-gray-900 dark:text-white">No wallet detected</p>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Install one of these, then try again:
          </p>
          <ul className="mt-3 space-y-2">
            {noWalletOptions.map((wallet) => (
              <li key={wallet.id}>
                <a
                  href={wallet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-black underline dark:text-white"
                >
                  {wallet.name}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={dismissNoWalletPrompt}
            className="mt-3 text-xs font-medium text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={connecting}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:focus-visible:ring-teal-400"
    >
      Connect Wallet
    </button>
  );
}
