import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getApplicationStatus, submitNgoApplication } from '@/lib/api';
import { NGO_REGISTRY_ERRORS } from '@/lib/contractTypes';

const OWNER_ADDRESS = 'G' + 'A'.repeat(55);

const { wallet, register, signAndSend } = vi.hoisted(() => ({
  wallet: {
    address: null as string | null,
    connecting: false,
    connect: vi.fn(),
  },
  register: vi.fn(),
  signAndSend: vi.fn(),
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => wallet,
}));

vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, submitNgoApplication: vi.fn(), getApplicationStatus: vi.fn() };
});

vi.mock('@/lib/ngoRegistryClient', () => ({
  useNgoRegistryClient: () => ({ client: { register }, ready: true }),
}));

import ApplyPage from './page';

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Organization name'), '  Community Garden  ');
  await user.type(screen.getByRole('textbox', { name: /^Description/ }), '  A local garden.  ');
  await user.type(screen.getByLabelText('Contact email'), 'garden@example.org');
}

describe('ApplyPage', () => {
  beforeEach(() => {
    wallet.address = OWNER_ADDRESS;
    wallet.connecting = false;
    wallet.connect.mockReset().mockResolvedValue(undefined);
    register.mockReset().mockResolvedValue({ signAndSend });
    signAndSend.mockReset().mockResolvedValue(undefined);
    vi.mocked(submitNgoApplication).mockReset().mockResolvedValue({
      id: 'application-1',
      ownerAddress: OWNER_ADDRESS,
      name: 'Community Garden',
      description: 'A local garden.',
      contactEmail: 'garden@example.org',
      website: null,
      country: null,
      status: 'PENDING',
      reviewNote: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(getApplicationStatus).mockReset().mockResolvedValue(null);
  });

  it('hides the form until a wallet is connected', async () => {
    wallet.address = null;
    const user = userEvent.setup();
    const { rerender } = render(<ApplyPage />);

    expect(screen.getByText('Connect your wallet to apply.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument();
    expect(getApplicationStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Connect Wallet' }));
    expect(wallet.connect).toHaveBeenCalledTimes(1);

    wallet.address = OWNER_ADDRESS;
    rerender(<ApplyPage />);

    expect(screen.getByLabelText('Organization name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled();
    expect(getApplicationStatus).toHaveBeenCalledWith(OWNER_ADDRESS);
    expect(register).not.toHaveBeenCalled();
    expect(submitNgoApplication).not.toHaveBeenCalled();
  });

  it('keeps the form hidden while the wallet is connecting', () => {
    wallet.address = null;
    wallet.connecting = true;
    render(<ApplyPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument();
    expect(getApplicationStatus).not.toHaveBeenCalled();
  });

  it('registers and waits for signing before submitting the application', async () => {
    let finishSigning!: () => void;
    signAndSend.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSigning = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ApplyPage />);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Website (optional)'), 'https://garden.example.org');
    await user.type(screen.getByLabelText('Country (optional)'), '  Nigeria  ');
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(register).toHaveBeenCalledExactlyOnceWith({
      owner: OWNER_ADDRESS,
      name: 'Community Garden',
    });
    expect(signAndSend).toHaveBeenCalledTimes(1);
    expect(submitNgoApplication).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirm in your wallet/ })).toBeDisabled();

    await act(async () => {
      finishSigning();
    });

    expect(await screen.findByText('Application submitted!')).toBeInTheDocument();
    expect(submitNgoApplication).toHaveBeenCalledExactlyOnceWith({
      ownerAddress: OWNER_ADDRESS,
      name: 'Community Garden',
      description: 'A local garden.',
      contactEmail: 'garden@example.org',
      website: 'https://garden.example.org',
      country: 'Nigeria',
    });
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument();
  });

  it.each(['register', 'signAndSend'] as const)(
    'stops submission when %s fails',
    async (failingCall) => {
      const failingMock = failingCall === 'register' ? register : signAndSend;
      failingMock.mockRejectedValueOnce(new Error('Transaction rejected'));
      const user = userEvent.setup();
      render(<ApplyPage />);
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: 'Submit application' }));

      expect(
        await screen.findByText('Could not register on-chain: Transaction rejected'),
      ).toBeInTheDocument();
      expect(register).toHaveBeenCalledTimes(1);
      expect(signAndSend).toHaveBeenCalledTimes(failingCall === 'register' ? 0 : 1);
      expect(submitNgoApplication).not.toHaveBeenCalled();
      expect(screen.queryByText('Application submitted!')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit application' })).toBeEnabled();
    },
  );

  it.each(['register', 'signAndSend'] as const)(
    'continues submission when %s reports ALREADY_REGISTERED',
    async (failingCall) => {
      const failingMock = failingCall === 'register' ? register : signAndSend;
      failingMock.mockRejectedValueOnce(
        new Error(`Error(Contract, #${NGO_REGISTRY_ERRORS.ALREADY_REGISTERED})`),
      );
      const user = userEvent.setup();
      render(<ApplyPage />);
      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: 'Submit application' }));

      expect(await screen.findByText('Application submitted!')).toBeInTheDocument();
      expect(register).toHaveBeenCalledExactlyOnceWith({
        owner: OWNER_ADDRESS,
        name: 'Community Garden',
      });
      expect(signAndSend).toHaveBeenCalledTimes(failingCall === 'register' ? 0 : 1);
      expect(submitNgoApplication).toHaveBeenCalledExactlyOnceWith({
        ownerAddress: OWNER_ADDRESS,
        name: 'Community Garden',
        description: 'A local garden.',
        contactEmail: 'garden@example.org',
        website: undefined,
        country: undefined,
      });
      expect(screen.queryByText(/Could not register on-chain/)).not.toBeInTheDocument();
    },
  );

  it('shows the duplicate-application message for a 409 response', async () => {
    vi.mocked(submitNgoApplication).mockRejectedValue(
      new ApiError('An application from this address is already pending review.', 409),
    );

    const user = userEvent.setup();
    render(<ApplyPage />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(await screen.findByText(/already pending review/i)).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
  });
});
