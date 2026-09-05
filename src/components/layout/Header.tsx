import Link from 'next/link';

import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sm:px-12">
      <Link href="/" className="text-lg font-bold">
        StreamGive
      </Link>
      <nav className="flex items-center gap-6">
        <Link href="/ngos" className="text-sm font-medium text-gray-600 hover:text-black">
          Explore NGOs
        </Link>
        <ConnectWalletButton />
      </nav>
    </header>
  );
}
