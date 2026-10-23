import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getNgo, getNgos, type Ngo, type NgoProfile } from '@/lib/api';

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
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/ngos',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  getNgos: vi.fn(),
  getNgo: vi.fn(),
}));

import NgosPage from './page';

function makeNgo(id: string): Ngo {
  return {
    id,
    ownerAddress: 'G' + 'A'.repeat(55),
    name: `NGO ${id}`,
    verified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeProfile(id: string): NgoProfile {
  return {
    ...makeNgo(id),
    stats: { totalCommitted: '0', totalWithdrawn: '0', activeStreamCount: 0, donorCount: 0 },
  };
}

describe('NgosPage', () => {
  it('still shows NGOs whose profile loaded when another profile fails (#213)', async () => {
    vi.mocked(getNgos).mockResolvedValue([makeNgo('ngo-1'), makeNgo('ngo-2'), makeNgo('ngo-3')]);
    vi.mocked(getNgo).mockImplementation(async (id: string) => {
      if (id === 'ngo-2') {
        throw new Error('Failed to fetch NGO ngo-2: 503');
      }
      return makeProfile(id);
    });

    render(await NgosPage());

    expect(screen.getByText('NGO ngo-1')).toBeInTheDocument();
    expect(screen.getByText('NGO ngo-3')).toBeInTheDocument();
    expect(screen.queryByText('NGO ngo-2')).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load the NGO list/)).not.toBeInTheDocument();
  });

  it('shows the error state when the NGO list itself cannot be fetched', async () => {
    vi.mocked(getNgos).mockRejectedValue(new Error('Failed to fetch NGOs: 503'));

    render(await NgosPage());

    expect(screen.getByText(/Couldn't load the NGO list/)).toBeInTheDocument();
  });
});
