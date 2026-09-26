'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/layout/Logo';
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
  const pathname = usePathname();

  const isActiveLink = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Close the mobile menu when the viewport widens past the md breakpoint
  // (768 px — matches Tailwind's default) so the open state doesn't linger
  // underneath the now-visible desktop nav.
  useEffect(() => {
    const MD_BREAKPOINT = 768;
    const handleResize = () => {
      if (window.innerWidth >= MD_BREAKPOINT) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-gray-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:bg-gray-900 dark:focus:text-white"
      >
        Skip to content
      </a>
      <header className="border-b border-gray-200 px-6 py-4 sm:px-12 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold"
            onClick={() => setMenuOpen(false)}
          >
            <Logo className="h-5 w-auto" />
            StreamGive
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = isActiveLink(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'rounded-md border border-transparent px-2 py-1 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'text-gray-600 hover:border-gray-200 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              );
            })}
            <ConnectWalletButton />
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle menu"
            className="rounded-md p-2 hover:bg-gray-100 md:hidden dark:hover:bg-gray-800"
          >
            <svg
              aria-hidden="true"
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
          <nav id="mobile-nav" className="mt-4 flex flex-col gap-4 md:hidden">
            {NAV_LINKS.map((link) => {
              const isActive = isActiveLink(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'rounded-md border-l-2 border-transparent px-2 py-1 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'text-gray-600 hover:border-gray-200 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              );
            })}
            <ConnectWalletButton />
          </nav>
        )}
      </header>
    </>
  );
}
