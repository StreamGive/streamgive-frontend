'use client';

import { useEffect, useState } from 'react';

import {
  applyThemePreference,
  getStoredPreference,
  getSystemTheme,
  type Theme,
  type ThemePreference,
} from '@/lib/theme';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

/** Monitor icon — represents "follow system preference". */
function SystemIcon() {
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
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

function nextPreference(current: ThemePreference): ThemePreference {
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
}

const LABELS: Record<ThemePreference, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Three-way theme toggle: light → dark → system (follow OS) → light …
 *
 * Behaviour:
 * - Cycles through the three preferences on click.
 * - In 'system' mode, a matchMedia listener reacts immediately when the OS
 *   theme changes at sunset/sunrise without requiring a page reload.
 * - A 'storage' event listener keeps the toggle in sync across browser tabs:
 *   opening a new tab and changing the preference there will update every
 *   other open tab automatically.
 * - The icon is suppressed until mounted to avoid a server/client hydration
 *   mismatch (the server doesn't know the user's stored preference).
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [mounted, setMounted] = useState(false);

  // On mount: read the stored preference and start listening for cross-tab
  // changes and OS theme changes.
  useEffect(() => {
    // Read browser storage after hydration so the initial markup matches
    // the server while restoring the user's saved preference on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreference(getStoredPreference());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    // Cross-tab sync: another tab wrote a new value (or cleared it) in
    // localStorage — mirror it here without reloading the page.
    function handleStorage(event: StorageEvent): void {
      if (event.key !== 'theme') return;
      const incoming: ThemePreference =
        event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : 'system';
      // Apply visually (the other tab already wrote to storage, so we only
      // need to update the DOM and local state).
      applyThemePreference(incoming);
      setPreference(incoming);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // OS theme listener — only active while the user is in 'system' mode.
  // When the OS flips (e.g. macOS auto dark mode at sunset) we re-apply so
  // the page updates without waiting for a reload.
  useEffect(() => {
    if (!mounted) return;
    if (preference !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    function handleChange(): void {
      // Re-resolve system theme against the new OS setting.
      applyThemePreference('system');
      // No setPreference needed — the preference is still 'system'.
    }

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mounted, preference]);

  function toggle(): void {
    const next = nextPreference(preference);
    applyThemePreference(next);
    setPreference(next);
  }

  // Derive the visual theme for rendering (system resolves to the current OS
  // setting, used only to decide which icon to show when in system mode).
  const resolvedTheme: Theme = mounted
    ? preference === 'system'
      ? getSystemTheme()
      : preference
    : 'light';

  const icon =
    preference === 'system' ? (
      <SystemIcon />
    ) : resolvedTheme === 'dark' ? (
      <SunIcon />
    ) : (
      <MoonIcon />
    );

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? LABELS[preference] : 'Toggle theme'}
      title={mounted ? LABELS[preference] : 'Toggle theme'}
      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:ring-teal-400"
    >
      {mounted && icon}
    </button>
  );
}
