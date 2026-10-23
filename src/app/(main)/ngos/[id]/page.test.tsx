import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNgo, type NgoProfile, type Stream } from '@/lib/api';

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
  render(await NgoProfilePage({ params: Promise.resolve({ id: ngo.id }) }));
}

describe('NgoProfilePage', () => {
  beforeEach(() => {
    vi.mocked(getNgo).mockResolvedValue(NGO);
  });

  it('shows totalCommitted and totalWithdrawn formatted, not as raw base units', async () => {
    const jsx = await NgoProfilePage({ params: Promise.resolve({ id: NGO.id }) });
    render(jsx);

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
});
