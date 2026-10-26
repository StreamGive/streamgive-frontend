import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Stream } from '@/lib/api';
import { useDonationVaultClient } from '@/lib/donationVaultClient';

import { NgoAdminStreamList } from './NgoAdminStreamList';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: 'G' + 'N'.repeat(55),
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    noWalletOptions: null,
    dismissNoWalletPrompt: vi.fn(),
    networkMismatch: false,
  }),
}));

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/lib/donationVaultClient', () => ({
  useDonationVaultClient: vi.fn(),
}));

function stream(overrides: Partial<Stream>): Stream {
  return {
    id: overrides.id ?? 'stream-1',
    onChainId: '1',
    tokenAddress: 'CTOKEN',
    rate: '100',
    balance: '1000000000', // 100.0
    withdrawn: '0',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    donor: { address: DONOR_ADDRESS },
    ngo: { id: 'ngo-1', name: 'Test NGO', ownerAddress: 'GOWNER' },
    ...overrides,
  };
}

describe('NgoAdminStreamList', () => {
  beforeEach(() => {
    vi.mocked(useDonationVaultClient).mockReturnValue({
      client: null,
      ready: false,
      initError: null,
      retryInit: vi.fn(),
    });
  });

  it('renders nothing to filter/sort when there are no streams at all', () => {
    render(<NgoAdminStreamList streams={[]} onWithdrawn={vi.fn()} onViewDetails={vi.fn()} />);

    expect(screen.getByText(/no one has started a stream to you yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    const streams = [
      stream({ id: 'active-1', status: 'ACTIVE' }),
      stream({ id: 'cancelled-1', status: 'CANCELLED' }),
    ];
    const user = userEvent.setup();
    render(<NgoAdminStreamList streams={streams} onWithdrawn={vi.fn()} onViewDetails={vi.fn()} />);

    // Both visible by default ("All").
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText(/status/i), 'active');
    let items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Active');

    await user.selectOptions(screen.getByLabelText(/status/i), 'cancelled');
    items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Cancelled');
  });

  it('shows a distinct empty state when a filter matches nothing', async () => {
    const streams = [stream({ id: 'active-1', status: 'ACTIVE' })];
    const user = userEvent.setup();
    render(<NgoAdminStreamList streams={streams} onWithdrawn={vi.fn()} onViewDetails={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/status/i), 'cancelled');

    expect(screen.getByText(/no streams match this filter/i)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('sorts by committed amount (balance), ascending and descending', async () => {
    const streams = [
      stream({ id: 'small', balance: '100', donor: { address: 'G' + '1'.repeat(55) } }),
      stream({ id: 'large', balance: '999999999999', donor: { address: 'G' + '2'.repeat(55) } }),
    ];
    const user = userEvent.setup();
    render(<NgoAdminStreamList streams={streams} onWithdrawn={vi.fn()} onViewDetails={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'amount-desc');
    let items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('G222…2222');
    expect(items[1]).toHaveTextContent('G111…1111');

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'amount-asc');
    items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('G111…1111');
    expect(items[1]).toHaveTextContent('G222…2222');
  });

  it('sorts by date, newest and oldest first', async () => {
    const streams = [
      stream({
        id: 'older',
        createdAt: '2026-01-01T00:00:00.000Z',
        donor: { address: 'G' + '1'.repeat(55) },
      }),
      stream({
        id: 'newer',
        createdAt: '2026-06-01T00:00:00.000Z',
        donor: { address: 'G' + '2'.repeat(55) },
      }),
    ];
    const user = userEvent.setup();
    render(<NgoAdminStreamList streams={streams} onWithdrawn={vi.fn()} onViewDetails={vi.fn()} />);

    // "Newest first" is the default.
    let items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('G222…2222');
    expect(items[1]).toHaveTextContent('G111…1111');

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'date-asc');
    items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('G111…1111');
    expect(items[1]).toHaveTextContent('G222…2222');
  });

  it('combines an active filter with a sort option', async () => {
    const streams = [
      stream({
        id: 'active-small',
        status: 'ACTIVE',
        balance: '100',
        donor: { address: 'G' + '1'.repeat(55) },
      }),
      stream({
        id: 'active-large',
        status: 'ACTIVE',
        balance: '999999999999',
        donor: { address: 'G' + '2'.repeat(55) },
      }),
      stream({
        id: 'cancelled-large',
        status: 'CANCELLED',
        balance: '999999999999999',
        donor: { address: 'G' + '3'.repeat(55) },
      }),
    ];
    const user = userEvent.setup();
    render(<NgoAdminStreamList streams={streams} onWithdrawn={vi.fn()} onViewDetails={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/status/i), 'active');
    await user.selectOptions(screen.getByLabelText(/sort by/i), 'amount-desc');

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('G222…2222');
    expect(items[1]).toHaveTextContent('G111…1111');
  });

  it('calls onViewDetails with the clicked stream', async () => {
    const streams = [stream({ id: 'only' })];
    const onViewDetails = vi.fn();
    const user = userEvent.setup();
    render(
      <NgoAdminStreamList streams={streams} onWithdrawn={vi.fn()} onViewDetails={onViewDetails} />,
    );

    await user.click(screen.getByRole('button', { name: /view details/i }));

    expect(onViewDetails).toHaveBeenCalledWith(streams[0]);
  });
});
