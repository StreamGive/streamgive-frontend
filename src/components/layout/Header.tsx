'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';

const NAV_LINKS = [
  { href: '/ngos', label: 'Explore NGOs' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/impact', label: 'Impact' },
  { href: '/apply', label: 'Apply as NGO' },
  { href: '/ngo-admin', label: 'NGO Admin' },
  { href: '/platform-admin', label: 'Platform Admin' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 px-6 py-4 sm:px-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold" onClick={() => setMenuOpen(false)}>
          StreamGive
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-black"
            >
              {link.label}
            </Link>
          ))}
          <ConnectWalletButton />
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          className="rounded-md p-2 hover:bg-gray-100 md:hidden"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav className="mt-4 flex flex-col gap-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-gray-600 hover:text-black"
            >
              {link.label}
            </Link>
          ))}
          <ConnectWalletButton />
        </nav>
      )}
    </header>
  );
}
