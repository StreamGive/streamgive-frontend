import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNgos, type Ngo } from '@/lib/api';

const BASE_URL = 'https://streamgive.example.com';
const STATIC_URLS = [BASE_URL, `${BASE_URL}/ngos`, `${BASE_URL}/impact`, `${BASE_URL}/apply`];

vi.mock('@/lib/api', () => ({
  getNgos: vi.fn(),
}));

function makeNgo(id: string, verified: boolean): Ngo {
  return {
    id,
    ownerAddress: 'G' + 'A'.repeat(55),
    name: `NGO ${id}`,
    verified,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };
}

describe('sitemap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', BASE_URL);
    vi.mocked(getNgos).mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uses the configured APP_URL origin for all sitemap entries', async () => {
    vi.mocked(getNgos).mockResolvedValue([makeNgo('verified-ngo', true)]);

    // Import after stubbing so @/lib/config picks up the new env value.
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/streamgive\.example\.com/);
      expect(entry.url).not.toMatch(/localhost/);
    }
  });

  it('lists exactly the static public pages when there are no NGOs', async () => {
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual(STATIC_URLS);
    expect(getNgos).toHaveBeenCalledTimes(1);
  });

  it('lists the static pages and verified NGOs only', async () => {
    vi.mocked(getNgos).mockResolvedValue([
      makeNgo('unverified-1', false),
      makeNgo('verified-1', true),
      makeNgo('unverified-2', false),
      makeNgo('verified-2', true),
    ]);
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      ...STATIC_URLS,
      `${BASE_URL}/ngos/verified-1`,
      `${BASE_URL}/ngos/verified-2`,
    ]);
    expect(entries.slice(STATIC_URLS.length)).toEqual([
      {
        url: `${BASE_URL}/ngos/verified-1`,
        lastModified: new Date('2026-02-01T00:00:00.000Z'),
        changeFrequency: 'daily',
        priority: 0.7,
      },
      {
        url: `${BASE_URL}/ngos/verified-2`,
        lastModified: new Date('2026-02-01T00:00:00.000Z'),
        changeFrequency: 'daily',
        priority: 0.7,
      },
    ]);
  });

  it('keeps only static pages when every NGO is unverified', async () => {
    vi.mocked(getNgos).mockResolvedValue([makeNgo('unverified-ngo', false)]);
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual(STATIC_URLS);
  });

  it('still lists the static pages when the NGO API fails', async () => {
    vi.mocked(getNgos).mockRejectedValue(new Error('API unavailable'));
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual(STATIC_URLS);
  });
});
