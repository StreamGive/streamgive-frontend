import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as ApiMod from '@/lib/api';
import type { Withdrawal } from '@/lib/api';

import { WithdrawalHistory } from './WithdrawalHistory';

vi.mock('@/lib/api', () => ({
  getWithdrawals: vi.fn(),
}));

function makeWithdrawal(overrides: Partial<Withdrawal> = {}): Withdrawal {
  return {
    id: 'w1',
    streamId: '42',
    amount: '1000000000', // 100.0
    createdAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('WithdrawalHistory', () => {
  it('shows date, stream id, and net amount for each withdrawal', async () => {
    vi.spyOn(ApiMod, 'getWithdrawals').mockResolvedValue([
      makeWithdrawal({ id: 'w1', streamId: '42', amount: '1000000000' }),
    ]);

    render(<WithdrawalHistory ngoId="ngo-1" />);

    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-01-15T00:00:00.000Z').toLocaleString())).toBeInTheDocument();
  });

  it('shows an empty state when there are no withdrawals yet', async () => {
    vi.spyOn(ApiMod, 'getWithdrawals').mockResolvedValue([]);

    render(<WithdrawalHistory ngoId="ngo-1" />);

    expect(await screen.findByText('No withdrawals yet.')).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(ApiMod, 'getWithdrawals').mockRejectedValue(new Error('network error'));

    render(<WithdrawalHistory ngoId="ngo-1" />);

    expect(await screen.findByText(/couldn't load withdrawal history/i)).toBeInTheDocument();
  });

  it('re-fetches when ngoId changes', async () => {
    const getWithdrawalsMock = vi.spyOn(ApiMod, 'getWithdrawals').mockResolvedValue([]);

    const { rerender } = render(<WithdrawalHistory ngoId="ngo-1" />);
    await screen.findByText('No withdrawals yet.');
    expect(getWithdrawalsMock).toHaveBeenCalledWith('ngo-1', expect.anything());

    rerender(<WithdrawalHistory ngoId="ngo-2" />);
    await screen.findByText('No withdrawals yet.');
    expect(getWithdrawalsMock).toHaveBeenCalledWith('ngo-2', expect.anything());
  });
});
