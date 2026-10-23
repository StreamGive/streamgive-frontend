import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY } from '@/lib/theme';

import { ThemeToggle } from './ThemeToggle';

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: dark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
  mockSystemTheme(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});

describe('ThemeToggle', () => {
  it('cycles through light, dark and system, persisting only explicit preferences', async () => {
    const user = userEvent.setup();
    mockSystemTheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    document.documentElement.classList.add('light');
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to system mode' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));

    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it.each([
    ['light', true, 'Switch to dark mode', 'dark'],
    ['dark', false, 'Switch to system mode', 'light'],
  ] as const)(
    'starts with stored %s despite the opposite system theme',
    (stored, dark, label, opposite) => {
      mockSystemTheme(dark);
      localStorage.setItem(THEME_STORAGE_KEY, stored);
      // Simulate the class set before hydration; theme.test.ts covers the script itself.
      document.documentElement.classList.add(stored);

      render(<ThemeToggle />);

      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
      expect(document.documentElement).toHaveClass(stored);
      expect(document.documentElement).not.toHaveClass(opposite);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(stored);
    },
  );

  it('keeps switching themes when storage reads, writes and removals fail', async () => {
    const user = userEvent.setup();
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
    }

    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');

    await user.click(screen.getByRole('button', { name: 'Switch to system mode' }));
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});
