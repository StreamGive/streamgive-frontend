import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDonationVaultClient } from '@/lib/donationVaultClient';
import { DONATION_VAULT_ERRORS } from '@/lib/contractTypes';

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
const withdraw = vi.fn(async (): Promise<{
  built?: { fee: string };
  signAndSend: () => Promise<unknown>;
}> => ({ signAndSend }));
// 25_000_000 base units = 2.5 XLM accrued.
const pendingAccrual = vi.fn(async () => ({ result: 25_000_000n }));

vi.mock('@/lib/donationVaultClient', () => ({
  useDonationVaultClient: vi.fn(),
}));

async function startWithdraw(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Withdraw' }));
  await user.click(await screen.findByRole('button', { name: 'Confirm' }));
}

describe('WithdrawButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingAccrual.mockResolvedValue({ result: 25_000_000n });
    vi.mocked(useDonationVaultClient).mockReturnValue({
      client: { withdraw, pending_accrual: pendingAccrual } as never,
      ready: true,
    });
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

  it('shows the accrued amount and asks for confirmation before signing', async () => {
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(pendingAccrual).toHaveBeenCalledWith({ stream_id: 1n });
    expect(await screen.findByText('Withdraw 2.5 now?')).toBeInTheDocument();
    expect(withdraw).not.toHaveBeenCalled();
    expect(signAndSend).not.toHaveBeenCalled();
  });

  it('does not sign when the confirmation is cancelled', async () => {
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(withdraw).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
  });

  it('shows a friendly message instead of confirming when nothing has accrued', async () => {
    pendingAccrual.mockResolvedValue({ result: 0n });
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByText(/nothing to withdraw yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(withdraw).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('withdraws and shows a success toast', async () => {
    signAndSend.mockResolvedValue(undefined);
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await startWithdraw(user);

    expect(withdraw).toHaveBeenCalledWith({ stream_id: 1n });
    expect(signAndSend).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'success',
      expect.stringMatching(/withdrawal submitted/i),
      undefined,
    );
    expect(onWithdrawn).toHaveBeenCalled();
  });

  it('includes a View transaction action link when transaction hash is returned', async () => {
    signAndSend.mockResolvedValue({ hash: 'tx12345' });
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await startWithdraw(user);

    expect(showToast).toHaveBeenCalledWith(
      'success',
      expect.stringMatching(/withdrawal submitted/i),
      expect.objectContaining({
        label: 'View transaction',
        url: expect.stringContaining('/tx/tx12345'),
      }),
    );
  });

  it('shows an error toast and does not call onWithdrawn when the transaction is rejected', async () => {
    signAndSend.mockRejectedValue(new Error('User declined access'));
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await startWithdraw(user);

    expect(await screen.findByRole('button', { name: 'Withdraw' })).not.toBeDisabled();
    expect(showToast).toHaveBeenCalledWith('error', 'User declined access');
    expect(onWithdrawn).not.toHaveBeenCalled();
  });

  it("shows the contract's error and does not call onWithdrawn on NothingToWithdraw", async () => {
    withdraw.mockRejectedValueOnce(
      new Error(`contract error: Error(Contract, #${DONATION_VAULT_ERRORS.NOTHING_TO_WITHDRAW})`),
    );
    const onWithdrawn = vi.fn();
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={onWithdrawn} />);
    await startWithdraw(user);

    expect(await screen.findByRole('button', { name: 'Withdraw' })).not.toBeDisabled();
    expect(showToast).toHaveBeenCalledWith(
      'error',
      'Nothing to withdraw yet — funds accrue as the stream runs.',
    );
    expect(signAndSend).not.toHaveBeenCalled();
    expect(onWithdrawn).not.toHaveBeenCalled();
  });

  it('disables the button and shows "Withdrawing…" while the transaction is in flight', async () => {
    signAndSend.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await startWithdraw(user);

    expect(await screen.findByRole('button', { name: 'Withdrawing…' })).toBeDisabled();
  });

  it('shows the estimated network fee once the transaction is assembled', async () => {
    withdraw.mockResolvedValueOnce({
      built: { fee: '1000000' },
      signAndSend: () => new Promise(() => {}),
    });
    const user = userEvent.setup();

    render(<WithdrawButton streamOnChainId="1" onWithdrawn={vi.fn()} />);
    await startWithdraw(user);

    // 1 000 000 stroops = 0.1 XLM.
    expect(await screen.findByText('Fee ≈ 0.1 XLM')).toBeInTheDocument();
  });
});
