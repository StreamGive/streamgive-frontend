import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatDate } from '@/lib/format';
import { getNgo, type NgoProfile, type Stream } from '@/lib/api';
import { renderWithIntl } from '@/test/renderWithIntl';

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');
  const { default: messages } = await import('../../../../../messages/en.json');

  return {
    getLocale: async () => 'en',
    getTranslations: async () =>
      createTranslator({
        locale: 'en',
        messages: { NgoProfile: messages.NgoProfile },
        namespace: 'NgoProfile',
      }),
  };
});

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: null,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
  }),
}));

const NGO: NgoProfile = {
  id: 'ngo-1',
  ownerAddress: 'G' + 'N'.repeat(55),
  name: 'Test NGO',
  verified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stats: {
    // 5_0000000 / 1_0000000 base units = 5 / 1 XLM.
    totalCommitted: '50000000',
    totalWithdrawn: '10000000',
    activeStreamCount: 2,
    donorCount: 3,
  },
};

vi.mock('@/lib/api', () => ({
  getNgo: vi.fn(),
  getStreams: vi.fn(async (): Promise<Stream[]> => []),
}));

import NgoProfilePage from './page';

async function renderProfile(ngo: NgoProfile) {
  vi.mocked(getNgo).mockResolvedValue(ngo);
  renderWithIntl(await NgoProfilePage({ params: Promise.resolve({ id: ngo.id }) }));
}

describe('NgoProfilePage', () => {
  beforeEach(() => {
    vi.mocked(getNgo).mockResolvedValue(NGO);
  });

  it('shows totalCommitted and totalWithdrawn formatted, not as raw base units', async () => {
    const jsx = await NgoProfilePage({ params: Promise.resolve({ id: NGO.id }) });
    renderWithIntl(jsx);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('50000000')).not.toBeInTheDocument();
    expect(screen.queryByText('10000000')).not.toBeInTheDocument();
  });

  it('shows the description, website and country when the NGO has them', async () => {
    await renderProfile({
      ...NGO,
      description: 'We plant trees.',
      website: 'https://trees.example.org',
      country: 'Kenya',
    });

    expect(screen.getByText('We plant trees.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'https://trees.example.org/' });
    expect(link).toHaveAttribute('href', 'https://trees.example.org/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Kenya')).toBeInTheDocument();
  });

  it('renders cleanly when the NGO has no description, website or country', async () => {
    await renderProfile({ ...NGO, description: null, website: null, country: null });

    expect(screen.getByRole('heading', { name: 'Test NGO' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /example\.org/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Kenya')).not.toBeInTheDocument();
  });

  it('does not link a website with a non-http(s) scheme', async () => {
    await renderProfile({ ...NGO, website: 'javascript:alert(1)' });

    expect(screen.queryByRole('link', { name: /javascript/ })).not.toBeInTheDocument();
  });

  it('links the verified badge to the verification explainer page', async () => {
    await renderProfile(NGO);

    const badge = screen.getByRole('link', { name: 'Verified' });
    expect(badge).toHaveAttribute('href', '/verification');
  });

  it('renders a Report this NGO mailto link prefilled with the NGO id', async () => {
    await renderProfile(NGO);

    const reportLink = screen.getByRole('link', { name: /report this ngo/i });
    const href = reportLink.getAttribute('href') ?? '';
    expect(href).toMatch(/^mailto:report@streamgive\.org\?/);
    expect(decodeURIComponent(href)).toContain(NGO.id);
    expect(decodeURIComponent(href)).toContain(NGO.name);
  });

  it('shows "Verified since" with no expiry when verificationExpiresAt is omitted', async () => {
    const verifiedAt = '2026-02-15T12:00:00.000Z';
    await renderProfile({ ...NGO, verifiedAt, verificationExpiresAt: null });

    const expectedSince = formatDate(verifiedAt, 'en', { dateStyle: 'medium' });
    expect(screen.getByText(`Verified since ${expectedSince}`)).toBeInTheDocument();
    expect(screen.queryByText(/Verification expires/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verification expired/i)).not.toBeInTheDocument();
  });

  it('shows future "Verification expires" without expiring-soon warning when expiry is far away', async () => {
    const verifiedAt = '2026-01-10T00:00:00.000Z';
    const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await renderProfile({ ...NGO, verifiedAt, verificationExpiresAt: futureExpiry });

    const expectedSince = formatDate(verifiedAt, 'en', { dateStyle: 'medium' });
    const expectedExpiry = formatDate(futureExpiry, 'en', { dateStyle: 'medium' });
    expect(screen.getByText(`Verified since ${expectedSince}`)).toBeInTheDocument();
    expect(screen.getByText(`Verification expires ${expectedExpiry}`)).toBeInTheDocument();
    expect(screen.queryByText(/expires soon/i)).not.toBeInTheDocument();
  });

  it('shows an expiring-soon warning when verification expires within 30 days', async () => {
    const soonExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await renderProfile({ ...NGO, verificationExpiresAt: soonExpiry });

    const expectedExpiry = formatDate(soonExpiry, 'en', { dateStyle: 'medium' });
    expect(screen.getByText(`Verification expires soon (${expectedExpiry})`)).toBeInTheDocument();
  });

  it('shows expired status when verificationExpiresAt is in the past', async () => {
    const pastExpiry = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await renderProfile({ ...NGO, verificationExpiresAt: pastExpiry });

    const expectedExpiry = formatDate(pastExpiry, 'en', { dateStyle: 'medium' });
    expect(screen.getByText(`Verification expired ${expectedExpiry}`)).toBeInTheDocument();
  });
});
