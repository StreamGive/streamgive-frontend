import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Stream } from '@/lib/api';

import { StreamControls, computeModifyRate } from './StreamControls';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: DONOR_ADDRESS,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
  }),
}));

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

// signAndSend never settles, so the component stays in its in-flight state
// long enough to assert on the button labels.
const neverSettles = () => ({ signAndSend: () => new Promise(() => { }) });

vi.mock('@/lib/donationVaultClient', () => ({
  getDonationVaultClient: vi.fn(async () => ({
    top_up: vi.fn(async () => neverSettles()),
    modify_rate: vi.fn(async () => neverSettles()),
    cancel_stream: vi.fn(async () => neverSettles()),
  })),
}));

const STREAM: Stream = {
  id: 'stream-1',
  onChainId: '1',
  tokenAddress: 'CTOKEN',
  rate: '10',
  balance: '1000000000000',
  withdrawn: '0',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  donor: { address: DONOR_ADDRESS },
  ngo: { id: 'ngo-1', name: 'Test NGO', ownerAddress: 'G' + 'N'.repeat(55) },
};

describe('StreamControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Topping up…" only while a top-up is in flight', async () => {
    const user = userEvent.setup();
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Top up' }));
    await user.type(screen.getByLabelText(/amount to add/i), '5');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('button', { name: 'Topping up…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByText('Cancelling…')).not.toBeInTheDocument();
  });

  it('shows "Updating…" only while a rate change is in flight', async () => {
    const user = userEvent.setup();
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Modify rate' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('button', { name: 'Updating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByText('Cancelling…')).not.toBeInTheDocument();
  });

  it('shows "Cancelling…" while a cancellation is in flight', async () => {
    const user = userEvent.setup();
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

    expect(await screen.findByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Top up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Modify rate' })).toBeDisabled();
  });
});

describe('computeModifyRate', () => {
  it('divides balance by duration to produce the per-second rate', () => {
    // 1 000 000 000 000 raw units over 30 days (2 592 000 s)
    // = 385 802 n (integer division)
    expect(computeModifyRate('1000000000000', 30 * 24 * 60 * 60)).toBe(385802n);
  });

  it('returns null when balance is too small for the chosen duration', () => {
    // 100 raw units over 1 year (31 536 000 s) → 0 per second
    expect(computeModifyRate('100', 365 * 24 * 60 * 60)).toBeNull();
  });

  it('returns null for a zero balance', () => {
    expect(computeModifyRate('0', 60 * 60)).toBeNull();
  });
});
