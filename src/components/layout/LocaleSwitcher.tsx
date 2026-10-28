'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALES,
  type Locale,
} from '@/i18n/config';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Scaffolding for later real translations (issue: "Add i18n scaffolding") —
 * only `messages/en.json` and `messages/es.json` exist today, and only the
 * landing page reads from them (see HomePage and HowItWorks). Switching
 * still works end to end (it writes the NEXT_LOCALE cookie `request.ts`
 * reads and refreshes the page), it just won't change anything outside
 * those two components yet. See docs/I18N.md.
 */
function useSafeLocale(): Locale {
  try {
    return useLocale() as Locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function useSafeTranslations(namespace: string) {
  try {
    return useTranslations(namespace);
  } catch {
    return (key: string) => key;
  }
}

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function LocaleSwitcher() {
  const locale = useSafeLocale();
  const t = useSafeTranslations('LocaleSwitcher');
  const router = useSafeRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}`;
    router?.refresh();
  }

  return (
    <select
      aria-label={t('label')}
      value={locale}
      onChange={handleChange}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
