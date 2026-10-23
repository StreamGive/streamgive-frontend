/**
 * The set of locales this app can render. Adding a new one is a two-step
 * change: add its code here, then add the matching `messages/<code>.json`
 * file — see docs/I18N.md for the full walkthrough.
 */
export const LOCALES = ['en', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Name of the cookie the locale switcher writes and `request.ts` reads —
 * no path-based locale routing yet (see docs/I18N.md), so this is the only
 * thing that remembers the visitor's choice across requests. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
