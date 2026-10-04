import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDonationVaultClient } from '@/lib/donationVaultClient';

import { WithdrawButton } from './WithdrawButton';

const NGO_ADDRESS = 'G' + 'N'.repeat(55);

const showToast = vi.fn();

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: NGO_ADDRESS,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
  }),
}));

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

const signAndSend = vi.fn();
const withdraw = vi.fn(async () => ({ signAndSend }));

vi.mock('@/lib/donationVaultClient', () => ({
  useDonationVaultClient: vi.fn(),
}));

describe('WithdrawButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDonationVaultClient).mockReturnValue({ client: { withdraw } as never, ready: true });
  });

  it('has a visible focus-visible ring', () => {
    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Withdraw' })).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-teal-600',
    );
  });

  it('disables the button and shows a loading label while the contract client is not ready', () => {
    vi.mocked(useDonationVaultClient).mockReturnValue({ client: null, ready: false });

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('withdraws and shows a success toast', async () => {
    signAndSend.mockResolvedValue(undefined);
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(withdraw).toHaveBeenCalledWith({ stream_id: 1n });
    expect(signAndSend).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'success',
      expect.stringMatching(/withdrawal submitted/i),
    );
    expect(onWithdrawn).toHaveBeenCalled();
  });

  it('shows an error toast and does not call onWithdrawn when the transaction is rejected', async () => {
    signAndSend.mockRejectedValue(new Error('User declined access'));
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByRole('button', { name: 'Withdraw' })).not.toBeDisabled();
    expect(showToast).toHaveBeenCalledWith('error', 'User declined access');
    expect(onWithdrawn).not.toHaveBeenCalled();
  });

  it("shows the contract's error and does not call onWithdrawn on NothingToWithdraw", async () => {
    withdraw.mockRejectedValueOnce(new Error('contract error: Error(Contract, #4)'));
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByRole('button', { name: 'Withdraw' })).not.toBeDisabled();
    expect(showToast).toHaveBeenCalledWith('error', 'contract error: Error(Contract, #4)');
    expect(signAndSend).not.toHaveBeenCalled();
    expect(onWithdrawn).not.toHaveBeenCalled();
  });

  it('disables the button and shows "Withdrawing…" while the transaction is in flight', async () => {
    signAndSend.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByRole('button', { name: 'Withdrawing…' })).toBeDisabled();
  });

  it('shows the estimated network fee once the transaction is assembled', async () => {
    withdraw.mockResolvedValueOnce({
      built: { fee: '1000000' },
      signAndSend: () => new Promise(() => {}),
    });
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    // 1 000 000 stroops = 0.1 XLM.
    expect(await screen.findByText('Fee ≈ 0.1 XLM')).toBeInTheDocument();
  });
});
