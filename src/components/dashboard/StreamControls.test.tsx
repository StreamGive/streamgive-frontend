import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Stream } from '@/lib/api';

import { StreamControls, computeModifyRate } from './StreamControls';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);

// vi.mock factories are hoisted above imports, so anything they reference
// has to go through vi.hoisted to avoid a TDZ error — and doing so gives
// every test a stable showToast/useDonationVaultClient/getStreams reference
// to assert against, rather than a fresh vi.fn() per render.
const { showToast, useDonationVaultClient, getStreams } = vi.hoisted(() => ({
  showToast: vi.fn(),
  useDonationVaultClient: vi.fn(),
  getStreams: vi.fn(),
}));

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
  useToast: () => ({ showToast }),
}));

vi.mock('@/lib/donationVaultClient', () => ({ useDonationVaultClient }));

// Only getStreams is mocked here; @/lib/api's Stream type import above
// still resolves to the real module (a type-only import has no runtime
// effect), so this partial mock doesn't need to redeclare the rest of the
// module's exports.
vi.mock('@/lib/api', () => ({ getStreams }));

// signAndSend never settles, so the component stays in its in-flight state
// long enough to assert on the button labels.
const neverSettles = () => ({ signAndSend: () => new Promise(() => {}) });

type ActionResult = () => Promise<{
  built?: { fee: string };
  signAndSend: () => Promise<void>;
}>;

function clientReturning(overrides: {
  top_up?: ActionResult;
  modify_rate?: ActionResult;
  cancel_stream?: ActionResult;
}) {
  return {
    top_up: vi.fn(overrides.top_up ?? (async () => neverSettles())),
    modify_rate: vi.fn(overrides.modify_rate ?? (async () => neverSettles())),
    cancel_stream: vi.fn(overrides.cancel_stream ?? (async () => neverSettles())),
  };
}

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

// Small enough that every duration option (even the shortest, 1 week)
// divides it down to a zero per-second rate — used to exercise the
// "duration too long for this balance" validation path.
const TINY_BALANCE_STREAM: Stream = { ...STREAM, balance: '100' };

describe('StreamControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDonationVaultClient.mockReturnValue({ client: clientReturning({}), ready: true });
    // Default: the fresh fetch modify-rate makes before submitting (issue
    // #159) sees the same balance the stream prop already has, so tests
    // not specifically about staleness don't need their own override.
    getStreams.mockResolvedValue([STREAM]);
  });

  it('gives every idle-state action button a visible focus-visible ring', () => {
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    for (const name of ['Top up', 'Modify rate', 'Cancel']) {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-teal-600',
      );
    }
  });

  it('disables every action button and shows a loading indicator while the contract client is not ready', () => {
    useDonationVaultClient.mockReturnValue({ client: null, ready: false });
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Top up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Modify rate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing contract…');
  });

  it('announces operation feedback in a polite live region', () => {
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
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

  it('shows the estimated network fee once the top-up transaction is assembled', async () => {
    useDonationVaultClient.mockReturnValue({
      client: clientReturning({
        top_up: async () => ({
          built: { fee: '1000000' },
          signAndSend: () => new Promise(() => {}),
        }),
      }),
      ready: true,
    });
    const user = userEvent.setup();
    render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Top up' }));
    await user.type(screen.getByLabelText(/amount to add/i), '5');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // 1 000 000 stroops = 0.1 XLM.
    expect(await screen.findByText('Fee ≈ 0.1 XLM')).toBeInTheDocument();
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

  describe('mode switching', () => {
    it('returns to the idle buttons when Back is clicked from top-up mode', async () => {
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Top up' }));
      expect(screen.getByLabelText(/amount to add/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.queryByLabelText(/amount to add/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Top up' })).toBeInTheDocument();
    });

    it('returns to the idle buttons when Back is clicked from modify-rate mode', async () => {
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Modify rate' }));
      expect(screen.getByLabelText(/new duration/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.queryByLabelText(/new duration/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Modify rate' })).toBeInTheDocument();
    });

    it('returns to the idle buttons when Never mind is clicked from cancel confirmation', async () => {
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText(/cancel this stream/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Never mind' }));

      expect(screen.queryByText(/cancel this stream/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('top-up amount validation', () => {
    it('disables Confirm until a valid amount is entered', async () => {
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Top up' }));

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();

      await user.type(screen.getByLabelText(/amount to add/i), '0');
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();

      await user.clear(screen.getByLabelText(/amount to add/i));
      await user.type(screen.getByLabelText(/amount to add/i), '5');
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });
  });

  describe('top-up submission', () => {
    it('clears the amount and refreshes the list on success', async () => {
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({ top_up: async () => ({ signAndSend: async () => {} }) }),
        ready: true,
      });
      const onChanged = vi.fn();
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={onChanged} />);

      await user.click(screen.getByRole('button', { name: 'Top up' }));
      await user.type(screen.getByLabelText(/amount to add/i), '5');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('button', { name: 'Top up' })).toBeEnabled();
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('Stream topped up'),
      );
    });

    it('shows an error toast and stays interactive when the transaction fails', async () => {
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({
          top_up: async () => ({
            signAndSend: async () => {
              throw new Error('Insufficient balance');
            },
          }),
        }),
        ready: true,
      });
      const onChanged = vi.fn();
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={onChanged} />);

      await user.click(screen.getByRole('button', { name: 'Top up' }));
      await user.type(screen.getByLabelText(/amount to add/i), '5');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('button', { name: 'Top up' })).toBeEnabled();
      expect(showToast).toHaveBeenCalledWith('error', 'Insufficient balance');
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('modify-rate validation', () => {
    it('shows a validation error instead of submitting when the balance is too small for the duration', async () => {
      const client = clientReturning({});
      useDonationVaultClient.mockReturnValue({ client, ready: true });
      getStreams.mockResolvedValue([TINY_BALANCE_STREAM]);
      const user = userEvent.setup();
      render(<StreamControls stream={TINY_BALANCE_STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Modify rate' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(showToast).toHaveBeenCalledWith(
        'error',
        'Remaining balance is too small to stream over this duration.',
      );
      // Stays in modify-rate mode rather than entering a pending state.
      expect(screen.getByLabelText(/new duration/i)).toBeInTheDocument();
      expect(client.modify_rate).not.toHaveBeenCalled();
    });
  });

  describe('modify-rate submission', () => {
    it('computes the submitted rate from a freshly fetched balance, not the stale stream prop (#159)', async () => {
      const modifyRate = vi.fn(async () => ({ signAndSend: async () => {} }));
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({ modify_rate: modifyRate }),
        ready: true,
      });
      // The stream prop's balance is already stale by the time the donor
      // submits -- e.g. the NGO withdrew, or the stream itself drained
      // further, since the page last fetched it. getStreams returns a
      // materially different (smaller) balance, simulating exactly that.
      getStreams.mockResolvedValue([{ ...STREAM, balance: '500000000000' }]);

      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Modify rate' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await vi.waitFor(() => expect(modifyRate).toHaveBeenCalledTimes(1));
      // 500_000_000_000 / (30 days in seconds) = 192_901 -- the rate from
      // the fresh balance. The stale prop's balance (1_000_000_000_000)
      // would have produced 385_802 instead; asserting the fresh value is
      // what actually distinguishes this test from one that would pass
      // against the pre-fix code too.
      expect(modifyRate).toHaveBeenCalledWith({
        stream_id: 1n,
        new_rate: 192_901n,
      });
      expect(getStreams).toHaveBeenCalledWith({ donor: DONOR_ADDRESS });
    });

    it('refreshes the list on success', async () => {
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({ modify_rate: async () => ({ signAndSend: async () => {} }) }),
        ready: true,
      });
      const onChanged = vi.fn();
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={onChanged} />);

      await user.click(screen.getByRole('button', { name: 'Modify rate' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('button', { name: 'Modify rate' })).toBeEnabled();
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('Rate updated'));
    });

    it('shows an error toast when the transaction fails', async () => {
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({
          modify_rate: async () => ({
            signAndSend: async () => {
              throw new Error('Simulation failed');
            },
          }),
        }),
        ready: true,
      });
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Modify rate' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('button', { name: 'Modify rate' })).toBeEnabled();
      expect(showToast).toHaveBeenCalledWith('error', 'Simulation failed');
    });
  });

  describe('cancel submission', () => {
    it('refreshes the list on success', async () => {
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({ cancel_stream: async () => ({ signAndSend: async () => {} }) }),
        ready: true,
      });
      const onChanged = vi.fn();
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={onChanged} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeEnabled();
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('Stream cancelled'),
      );
    });

    it('shows an error toast when the transaction fails', async () => {
      useDonationVaultClient.mockReturnValue({
        client: clientReturning({
          cancel_stream: async () => ({
            signAndSend: async () => {
              throw new Error('Network error');
            },
          }),
        }),
        ready: true,
      });
      const user = userEvent.setup();
      render(<StreamControls stream={STREAM} onChanged={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeEnabled();
      expect(showToast).toHaveBeenCalledWith('error', 'Network error');
    });
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
