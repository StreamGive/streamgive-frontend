import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './config';

/**
 * Resolves the active locale for every request and loads its messages.
 *
 * There's no `[locale]` route segment yet (see docs/I18N.md for why, and
 * what adding real locale-prefixed routing would involve) — the locale
 * comes entirely from the `NEXT_LOCALE` cookie the switcher writes,
 * falling back to DEFAULT_LOCALE for a first-time visitor.
 */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
