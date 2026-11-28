/** 'system' means "follow prefers-color-scheme" — no stored override. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** The two visual outcomes (what actually gets applied to <html>). */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

/** 'on' | 'off' override for the high contrast theme. When unset, the CSS in
 * globals.css follows the `prefers-contrast` media query instead. */
export const CONTRAST_STORAGE_KEY = 'contrast';

/**
 * Inline script injected into <head> (see src/app/layout.tsx) and run
 * before hydration, so the correct theme class is already on <html> by the
 * time anything paints — without this, the page would flash the system
 * theme and then flip to the stored override a moment later.
 *
 * Kept as a plain string (not a shared function) because it has to run as
 * a standalone <script> tag, before any of the app's JS has loaded.
 *
 * Behaviour:
 *   stored === 'dark'  → add class 'dark'
 *   stored === 'light' → add class 'light'
 *   stored === null or any unknown value
 *                      → follow prefers-color-scheme (system mode); add
 *                        whichever class matches but do NOT persist it, so
 *                        a future OS-theme change will be respected.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');var c=localStorage.getItem('${CONTRAST_STORAGE_KEY}');if(c==='on'||c==='off')document.documentElement.setAttribute('data-contrast',c);}catch(e){}})();`;

/** Returns the stored explicit preference, or 'system' if none is set. */
export function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore — private browsing, quota, etc.
  }
  return 'system';
}

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Reads whichever theme is currently applied to <html> — set either by
 * THEME_INIT_SCRIPT before hydration, or by a previous call to applyTheme. */
export function getAppliedTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Applies a theme preference to <html> and persists it.
 *
 * - 'light' / 'dark': adds the matching class and saves to localStorage.
 * - 'system': removes the stored key so future page loads follow the OS,
 *   then immediately applies whichever class matches the current OS setting.
 */
export function applyThemePreference(preference: ThemePreference): void {
  const resolved: Theme = preference === 'system' ? getSystemTheme() : preference;

  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.classList.toggle('light', resolved === 'light');

  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Storage can be unavailable (private browsing, quota) — the toggle
    // still works for the rest of the session, it just won't persist.
  }
}

// ---------------------------------------------------------------------------
// Legacy alias — kept so callers that passed a Theme (not ThemePreference)
// continue to compile without changes. Remove once all call-sites are updated.
// ---------------------------------------------------------------------------
export function applyTheme(theme: Theme): void {
  applyThemePreference(theme);
}
