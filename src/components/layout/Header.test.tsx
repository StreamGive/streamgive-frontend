import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

const mockUsePathname = vi.fn(() => '/ngos');

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Just enough for LocaleSwitcher (rendered inside Header) to not crash for
// lack of a real NextIntlClientProvider context.
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

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

// With no wallet connected (see the mock above), NGO Admin and Platform
// Admin never render — these are the four links everyone gets.
const NAV_LINKS = [
  { href: '/ngos', label: 'Explore NGOs' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/impact', label: 'Impact' },
  { href: '/apply', label: 'Apply as NGO' },
];

beforeEach(() => {
  mockUsePathname.mockReturnValue('/ngos');
});

/** aria-current is only set on the mobile nav's links (see Header.tsx) — the
 * desktop nav doesn't currently highlight the active link at all. */
async function openMobileMenu() {
  const user = userEvent.setup();
  render(<Header />);
  await user.click(screen.getByRole('button', { name: 'Toggle menu' }));
  return document.getElementById('mobile-nav') as HTMLElement;
}

describe('Header', () => {
  it('renders all four navigation links with the correct hrefs', () => {
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

  describe('closing the mobile menu', () => {
    it('closes on Escape and returns focus to the toggle', async () => {
      const user = userEvent.setup();
      render(<Header />);
      const toggle = screen.getByRole('button', { name: 'Toggle menu' });

      await user.click(toggle);
      expect(document.getElementById('mobile-nav')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
      expect(toggle).toHaveFocus();
    });

    it('closes on a click outside the menu and returns focus to the toggle', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Header />
          <button type="button">Outside</button>
        </>,
      );
      const toggle = screen.getByRole('button', { name: 'Toggle menu' });

      await user.click(toggle);
      expect(document.getElementById('mobile-nav')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));

      expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
      expect(toggle).toHaveFocus();
    });

    it('stays open when the click is inside the menu itself', async () => {
      const user = userEvent.setup();
      render(<Header />);

      await user.click(screen.getByRole('button', { name: 'Toggle menu' }));
      fireEvent.mouseDown(document.getElementById('mobile-nav')!);

      expect(document.getElementById('mobile-nav')).toBeInTheDocument();
    });
  });

  describe('active link highlight', () => {
    it.each([
      { pathname: '/ngos', active: 'Explore NGOs' },
      { pathname: '/dashboard', active: 'Dashboard' },
      { pathname: '/impact', active: 'Impact' },
      { pathname: '/apply', active: 'Apply as NGO' },
      // A nested route under a nav link's href counts as active too —
      // isActiveLink() matches on startsWith(`${href}/`), not just equality.
      { pathname: '/ngos/some-ngo-id', active: 'Explore NGOs' },
      { pathname: '/dashboard/anything', active: 'Dashboard' },
      // No nav link matches the home page or an unrelated route.
      { pathname: '/', active: null },
      { pathname: '/some-other-page', active: null },
    ])('marks $active as current for $pathname', async ({ pathname, active }) => {
      mockUsePathname.mockReturnValue(pathname);
      const mobileNav = await openMobileMenu();

      for (const { label } of NAV_LINKS) {
        const link = Array.from(mobileNav.querySelectorAll('a')).find(
          (a) => a.textContent === label,
        ) as HTMLElement;

        if (label === active) {
          expect(link).toHaveAttribute('aria-current', 'page');
        } else {
          expect(link).not.toHaveAttribute('aria-current');
        }
      }
    });
  });
});
