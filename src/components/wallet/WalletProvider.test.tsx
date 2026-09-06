import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectWalletButton } from './ConnectWalletButton';
import { WalletProvider } from './WalletProvider';

const TEST_ADDRESS = 'G' + 'A'.repeat(55);

const mockGetAddress = vi.fn();
const mockAuthModal = vi.fn();

vi.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    getAddress: (...args: unknown[]) => mockGetAddress(...args),
    authModal: (...args: unknown[]) => mockAuthModal(...args),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
  },
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/utils', () => ({
  defaultModules: () => [],
}));

function renderButton() {
  return render(
    <WalletProvider>
      <ConnectWalletButton />
    </WalletProvider>,
  );
}

describe('wallet connect flow', () => {
  beforeEach(() => {
    mockGetAddress.mockReset();
    mockAuthModal.mockReset();
  });

  it('shows "Connect Wallet" when no session is restored', async () => {
    // getAddress() rejecting is the documented "nothing connected yet"
    // case — not an error, the common cold-start state.
    mockGetAddress.mockRejectedValue(new Error('not connected'));

    renderButton();

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('restores an already-authorized session on mount', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    renderButton();

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
  });

  it('shows the truncated address after connecting via the modal', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));
    mockAuthModal.mockResolvedValue({ address: TEST_ADDRESS });

    const user = userEvent.setup();
    renderButton();

    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
  });

  it('forgets the address on disconnect without an SDK call', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    const user = userEvent.setup();
    renderButton();

    // Looked up by role alone, not accessible name: the connected button's
    // aria-label carries the full address for screen readers, while its
    // visible text content is the truncated form — matched by text in the
    // other tests above.
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });
});
