import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getNgo, getStreams, type NgoProfile, type Stream } from '@/lib/api';

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

vi.mock('next/navigation', () => ({
  usePathname: () => '/ngos/ngo-1/donate/success',
}));

const NGO: NgoProfile = {
  id: 'ngo-1',
  ownerAddress: 'G' + 'N'.repeat(55),
  name: 'Test NGO',
  verified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stats: { totalCommitted: '0', totalWithdrawn: '0', activeStreamCount: 1, donorCount: 1 },
};

function makeStream(onChainId: string): Stream {
  return {
    id: 'stream-db-id',
    onChainId,
    tokenAddress: 'G' + 'T'.repeat(55),
    rate: '1',
    balance: '1',
    withdrawn: '0',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    donor: { address: 'G' + 'D'.repeat(55) },
    ngo: { id: NGO.id, name: NGO.name, ownerAddress: NGO.ownerAddress },
  };
}

vi.mock('@/lib/api', () => ({
  getNgo: vi.fn(),
  getStreams: vi.fn(),
}));

import DonateSuccessPage from './page';

describe('DonateSuccessPage', () => {
  it("names the stream when streamId matches one of the NGO's actual streams", async () => {
    vi.mocked(getNgo).mockResolvedValue(NGO);
    vi.mocked(getStreams).mockResolvedValue([makeStream('42')]);

    render(
      await DonateSuccessPage({
        params: Promise.resolve({ id: NGO.id }),
        searchParams: Promise.resolve({ streamId: '42' }),
      }),
    );

    expect(
      screen.getByText(/Stream #42 is now active, streaming to Test NGO\./),
    ).toBeInTheDocument();
  });

  // issue #215: a crafted ?streamId= for a stream that doesn't exist must
  // not produce a fake-looking confirmation naming that id.
  it('falls back to the generic message when streamId names no real stream', async () => {
    vi.mocked(getNgo).mockResolvedValue(NGO);
    vi.mocked(getStreams).mockResolvedValue([makeStream('42')]);

    render(
      await DonateSuccessPage({
        params: Promise.resolve({ id: NGO.id }),
        searchParams: Promise.resolve({ streamId: '999' }),
      }),
    );

    expect(screen.getByText('Your stream to Test NGO is now active.')).toBeInTheDocument();
    expect(screen.queryByText(/Stream #999/)).not.toBeInTheDocument();
  });

  it('falls back to the generic message when no streamId is given', async () => {
    vi.mocked(getNgo).mockResolvedValue(NGO);
    vi.mocked(getStreams).mockResolvedValue([makeStream('42')]);

    render(
      await DonateSuccessPage({
        params: Promise.resolve({ id: NGO.id }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText('Your stream to Test NGO is now active.')).toBeInTheDocument();
  });

  it('falls back to the generic message when the streams lookup fails', async () => {
    vi.mocked(getNgo).mockResolvedValue(NGO);
    vi.mocked(getStreams).mockRejectedValue(new Error('Failed to fetch streams: 503'));

    render(
      await DonateSuccessPage({
        params: Promise.resolve({ id: NGO.id }),
        searchParams: Promise.resolve({ streamId: '42' }),
      }),
    );

    expect(screen.getByText('Your stream to Test NGO is now active.')).toBeInTheDocument();
  });
});
