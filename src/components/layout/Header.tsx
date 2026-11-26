'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { useWallet } from '@/components/wallet/WalletProvider';
import { lookupNgoByAddress } from '@/lib/api';
import { PLATFORM_ADMIN_ADDRESS } from '@/lib/config';

const BASE_NAV_LINKS = [
  { href: '/ngos', key: 'exploreNgos' },
  { href: '/dashboard', key: 'dashboard' },
  { href: '/impact', key: 'impact' },
  { href: '/apply', key: 'applyAsNgo' },
] as const;

export function Header() {
  const t = useTranslations('Header');
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { address } = useWallet();
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  // Starts false and is only ever flipped true by a successful lookup, so
  // the link stays hidden (rather than briefly flashing on) while we don't
  // yet know whether this address owns an NGO.
  const [ownsNgo, setOwnsNgo] = useState(false);

  useEffect(() => {
    if (!address) {
      // A disconnected wallet must not keep showing the NGO Admin link from
      // a previous session's lookup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOwnsNgo(false);
      return;
    }
    let current = true;
    lookupNgoByAddress(address)
      .then((ngo) => {
        if (current) setOwnsNgo(ngo !== null);
      })
      .catch(() => {
        if (current) setOwnsNgo(false);
      });
    return () => {
      current = false;
    };
  }, [address]);

  const isPlatformAdmin = Boolean(address) && address === PLATFORM_ADMIN_ADDRESS;

  const navLinks = [
    ...BASE_NAV_LINKS,
    ...(ownsNgo ? [{ href: '/ngo-admin', key: 'ngoAdmin' as const }] : []),
    ...(isPlatformAdmin ? [{ href: '/platform-admin', key: 'platformAdmin' as const }] : []),
  ];

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

  // Escape, a click outside the open menu and choosing a link all close it.
  // Every close path returns focus to the toggle so keyboard and screen-reader
  // users land back where they opened the menu.
  const closeMenuAndRefocus = useCallback(() => {
    setMenuOpen(false);
    toggleButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenuAndRefocus();
      }
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (mobileNavRef.current?.contains(target)) return;
      if (toggleButtonRef.current?.contains(target)) return;
      closeMenuAndRefocus();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [closeMenuAndRefocus, menuOpen]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-gray-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:bg-gray-900 dark:focus:text-white"
      >
        {t('skipToContent')}
      </a>
      <header className="border-b border-gray-200 px-6 py-4 sm:px-12 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400"
            onClick={() => setMenuOpen(false)}
          >
            <Logo className="h-5 w-auto" />
            {t('brand')}
          </Link>

          <nav aria-label={t('mainNavigation')} className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md text-sm font-medium text-gray-600 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-gray-400 dark:hover:text-white dark:focus-visible:ring-teal-400"
              >
                {t(link.key)}
              </Link>
            ))}
            <LocaleSwitcher />
            <ThemeToggle />
            <ConnectWalletButton />
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              ref={toggleButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={t('toggleMenu')}
              className="rounded-md p-2 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:hover:bg-gray-800 dark:focus-visible:ring-teal-400"
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
        </div>

        {menuOpen && (
          <nav
            ref={mobileNavRef}
            id="mobile-nav"
            aria-label={t('mobileNavigation')}
            className="mt-4 flex flex-col gap-4 md:hidden"
          >
            {navLinks.map((link) => {
              const isActive = isActiveLink(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={closeMenuAndRefocus}
                  className={[
                    'rounded-md border-l-2 border-transparent px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400',
                    isActive
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'text-gray-600 hover:border-gray-200 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white',
                  ].join(' ')}
                >
                  {t(link.key)}
                </Link>
              );
            })}
            <LocaleSwitcher />
            <ConnectWalletButton />
          </nav>
        )}
      </header>
    </>
  );
}
