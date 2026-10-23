import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  applyThemePreference,
  getAppliedTheme,
  getStoredPreference,
  getSystemTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark }));
}

function runThemeInitScript(): HTMLElement {
  // Load the app's actual inline script as a browser would. The iframe keeps
  // its pre-hydration document separate from Vitest's document and globals.
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);

  try {
    const browser = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    if (!browser || !frameDocument) throw new Error('Theme test document unavailable');

    // Share the API mocks with the iframe's own browser context.
    browser.matchMedia = window.matchMedia;
    Object.defineProperty(browser, 'localStorage', { value: localStorage });

    let scriptError: string | undefined;
    browser.addEventListener('error', (event) => {
      scriptError = event.message;
      event.preventDefault();
    });

    const script = frameDocument.createElement('script');
    script.textContent = THEME_INIT_SCRIPT;
    frameDocument.head.appendChild(script);

    // DOM script errors are reported as events, rather than thrown by appendChild.
    if (scriptError !== undefined) throw new Error(scriptError);
    return frameDocument.documentElement;
  } finally {
    frame.remove();
  }
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

describe('getStoredPreference', () => {
  it.each(['light', 'dark'] as const)('returns a stored %s preference', (preference) => {
    localStorage.setItem(THEME_STORAGE_KEY, preference);

    expect(getStoredPreference()).toBe(preference);
  });

  it.each([null, '', 'system', 'invalid'])('falls back to system for %s', (stored) => {
    if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);

    expect(getStoredPreference()).toBe('system');
  });

  it('falls back to system when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(getStoredPreference()).toBe('system');
  });
});

describe('getSystemTheme', () => {
  it.each([
    [true, 'dark'],
    [false, 'light'],
  ] as const)('resolves a dark system preference of %s to %s', (dark, expected) => {
    mockSystemTheme(dark);

    expect(getSystemTheme()).toBe(expected);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });
});

describe('getAppliedTheme', () => {
  it('defaults to light when no dark class is present', () => {
    expect(getAppliedTheme()).toBe('light');
  });

  it('reads the dark class from the document', () => {
    document.documentElement.classList.add('dark');

    expect(getAppliedTheme()).toBe('dark');
  });
});

describe('applyThemePreference', () => {
  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const)('applies and persists %s over the system theme', (preference, opposite) => {
    mockSystemTheme(opposite === 'dark');
    document.documentElement.classList.add(opposite);

    applyThemePreference(preference);

    expect(document.documentElement).toHaveClass(preference);
    expect(document.documentElement).not.toHaveClass(opposite);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(preference);
  });

  it.each([
    [true, 'dark', 'light'],
    [false, 'light', 'dark'],
  ] as const)(
    'resolves system mode when dark preference is %s',
    (dark, expected, opposite) => {
      mockSystemTheme(dark);
      localStorage.setItem(THEME_STORAGE_KEY, opposite);
      document.documentElement.classList.add(opposite);

      applyThemePreference('system');

      expect(document.documentElement).toHaveClass(expected);
      expect(document.documentElement).not.toHaveClass(opposite);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    },
  );

  it('still applies an explicit preference when storage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });

    expect(() => applyThemePreference('dark')).not.toThrow();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('still applies the system theme when removing the stored preference fails', () => {
    mockSystemTheme(true);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(() => applyThemePreference('system')).not.toThrow();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('supports the legacy applyTheme alias', () => {
    applyTheme('dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it.each([
    ['light', true, 'dark'],
    ['dark', false, 'light'],
  ] as const)('uses stored %s over the system preference', (stored, systemDark, opposite) => {
    mockSystemTheme(systemDark);
    localStorage.setItem(THEME_STORAGE_KEY, stored);

    const html = runThemeInitScript();

    expect(html).toHaveClass(stored);
    expect(html).not.toHaveClass(opposite);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(stored);
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'dark', 'light'],
    [false, 'light', 'dark'],
  ] as const)(
    'follows the system without persisting when dark is %s',
    (dark, expected, opposite) => {
      mockSystemTheme(dark);
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      const html = runThemeInitScript();

      expect(html).toHaveClass(expected);
      expect(html).not.toHaveClass(opposite);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
    },
  );

  it('does not throw when storage is unavailable before hydration', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(() => runThemeInitScript()).not.toThrow();
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });
});
