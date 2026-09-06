import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateStreamForm } from './CreateStreamForm';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);
const NGO_ADDRESS = 'G' + 'N'.repeat(55);
const NATIVE_TOKEN_ADDRESS = 'CNATIVEFAKE';

const mockSignTransaction = vi.fn();

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: DONOR_ADDRESS,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: mockSignTransaction,
    signMessage: vi.fn(),
  }),
}));

vi.mock('@/lib/stellar', () => ({
  getNativeAssetAddress: () => NATIVE_TOKEN_ADDRESS,
}));

const mockCreateStream = vi.fn();

vi.mock('@/lib/donationVaultClient', () => ({
  getDonationVaultClient: vi.fn(async () => ({
    create_stream: mockCreateStream,
  })),
}));

describe('CreateStreamForm', () => {
  beforeEach(() => {
    mockCreateStream.mockReset();
  });

  it('disables submit until a valid amount is entered', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    const submit = screen.getByRole('button', { name: /review & sign/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText('100'), '100');

    expect(submit).not.toBeDisabled();
  });

  it('requires a token address once "Custom asset" is selected', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByLabelText(/custom asset/i));

    const submit = screen.getByRole('button', { name: /review & sign/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/token contract address/i), 'CTOKENADDRESS');
    expect(submit).not.toBeDisabled();
  });

  it('flags an amount too small to produce a positive per-second rate', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    // 0.0000001 * 10^7 = 1 raw unit; 1 / (30 days in seconds) rounds to 0.
    await user.type(screen.getByPlaceholderText('100'), '0.0000001');

    expect(screen.getByText(/too small to stream over this duration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review & sign/i })).toBeDisabled();
  });

  it('submits contract-shaped deposit/rate values and shows the resulting stream id', async () => {
    mockCreateStream.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({ result: 42n }),
    });

    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByRole('button', { name: /review & sign/i }));

    expect(await screen.findByText(/stream started/i)).toBeInTheDocument();
    expect(screen.getByText(/stream #42/i)).toBeInTheDocument();

    // 100 * 10^7 deposit, over the default 1-month duration (30 days).
    expect(mockCreateStream).toHaveBeenCalledWith({
      donor: DONOR_ADDRESS,
      ngo: NGO_ADDRESS,
      token: NATIVE_TOKEN_ADDRESS,
      deposit: 1_000_000_000n,
      rate: 1_000_000_000n / (30n * 24n * 60n * 60n),
    });
  });
});
