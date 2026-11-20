import { describe, expect, it } from 'vitest';

import { localeCookieString } from './LocaleSwitcher';

describe('localeCookieString', () => {
  it('sets SameSite=Lax and Secure on HTTPS', () => {
    expect(localeCookieString('es', 'https:')).toBe(
      'NEXT_LOCALE=es; path=/; max-age=31536000; SameSite=Lax; Secure',
    );
  });

  it('sets SameSite=Lax without Secure on HTTP', () => {
    expect(localeCookieString('en', 'http:')).toBe(
      'NEXT_LOCALE=en; path=/; max-age=31536000; SameSite=Lax',
    );
  });
});
