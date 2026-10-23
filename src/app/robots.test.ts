import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('robots', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://streamgive.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('disallows both admin areas, the dashboard and embeds for all crawlers', async () => {
    const { default: robots } = await import('./robots');

    expect(robots().rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/platform-admin', '/ngo-admin', '/dashboard', '/embed'],
    });
  });

  it('points crawlers to the sitemap on the configured app origin', async () => {
    const { default: robots } = await import('./robots');

    expect(robots().sitemap).toBe('https://streamgive.example.com/sitemap.xml');
  });

  it('uses the local sitemap URL when no app origin is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);
    const { default: robots } = await import('./robots');

    expect(robots().sitemap).toBe('http://localhost:3001/sitemap.xml');
  });
});
