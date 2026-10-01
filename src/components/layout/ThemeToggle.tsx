'use client';

import { useEffect, useState } from 'react';

import { applyTheme, getAppliedTheme, type Theme } from '@/lib/theme';

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Overrides the system color scheme. The class it toggles is applied to
 * <html> before hydration by THEME_INIT_SCRIPT (see src/lib/theme.ts and
 * the root layout), so `theme` only needs to read that already-applied
 * class rather than re-deriving it here.
 *
 * The icon renders only once mounted: rendering it immediately from
 * `getAppliedTheme()` would read a class the server-rendered markup
 * doesn't have, which is a hydration mismatch. Server and first client
 * render both render nothing here; the icon fills in right after.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getAppliedTheme());
    setMounted(true);
  }, []);

  function toggle(): void {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:ring-teal-400"
    >
      {mounted && (theme === 'dark' ? <SunIcon /> : <MoonIcon />)}
    </button>
  );
}
