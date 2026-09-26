import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NgoProfile, Stream } from '@/lib/api';

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
  getNgo: vi.fn(async () => NGO),
  getStreams: vi.fn(async (): Promise<Stream[]> => []),
}));

import NgoProfilePage from './page';

describe('NgoProfilePage', () => {
  it('shows totalCommitted and totalWithdrawn formatted, not as raw base units', async () => {
    const jsx = await NgoProfilePage({ params: Promise.resolve({ id: NGO.id }) });
    render(jsx);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('50000000')).not.toBeInTheDocument();
    expect(screen.queryByText('10000000')).not.toBeInTheDocument();
  });
});
