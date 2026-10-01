import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: null,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    networkMismatch: false,
  }),
}));

const NAV_LINKS = [
  { href: '/ngos', label: 'Explore NGOs' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/impact', label: 'Impact' },
  { href: '/apply', label: 'Apply as NGO' },
  { href: '/ngo-admin', label: 'NGO Admin' },
  { href: '/platform-admin', label: 'Platform Admin' },
];

describe('Header', () => {
  it('renders all six navigation links with the correct hrefs', () => {
    render(<Header />);

    for (const { href, label } of NAV_LINKS) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('toggles the mobile menu open and closed on click', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const toggle = screen.getByRole('button', { name: 'Toggle menu' });

    // The mobile <nav> is only mounted while open — the desktop <nav> stays
    // in the DOM at all times and is hidden purely by CSS, so its presence
    // isn't a useful signal here.
    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(document.getElementById('mobile-nav')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives every desktop nav link a visible focus-visible ring', () => {
    render(<Header />);

    for (const { label } of NAV_LINKS) {
      expect(screen.getByRole('link', { name: label })).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-teal-600',
      );
    }
  });

  it('gives the mobile menu toggle a visible focus-visible ring', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'Toggle menu' })).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-teal-600',
    );
  });

  it('closes the mobile menu when a nav link inside it is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(document.getElementById('mobile-nav')).toBeInTheDocument();

    const mobileNav = document.getElementById('mobile-nav') as HTMLElement;
    const [firstLink] = NAV_LINKS;
    const linksInMobileNav = Array.from(mobileNav.querySelectorAll('a'));
    const link = linksInMobileNav.find((a) => a.textContent === firstLink.label);
    await user.click(link!);

    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
  });
});
