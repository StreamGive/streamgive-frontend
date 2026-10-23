import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectWalletButton } from './ConnectWalletButton';
import { useWallet } from './WalletProvider';

const ADDRESS = 'GA4Z4GPSO3FKPMQJ3WCMU5D5WE25SDXZS47YDF3J3NWF65ILGCVJVWIJ';
const TRUNCATED = `${ADDRESS.slice(0, 4)}…${ADDRESS.slice(-4)}`;

// A vi.fn() stub (rather than a static return value) so each describe
// block below can give it its own mockImplementation — the disconnect
// flow needs one backed by useState (see that block's comment), while the
// connecting-state test just needs a fixed value.
vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: vi.fn(),
}));

const mockUseWallet = vi.mocked(useWallet);

describe('ConnectWalletButton disconnect flow', () => {
  beforeEach(() => {
    // useWallet is backed by a real useState call here, not a static
    // stub — ConnectWalletButton has no state of its own, so disconnect
    // only has something to re-render against if this mock actually holds
    // state the way the real WalletProvider context would.
    mockUseWallet.mockImplementation(() => {
      const [address, setAddress] = useState<string | null>(ADDRESS);
      return {
        address,
        connecting: false,
        connect: vi.fn(),
        disconnect: () => setAddress(null),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
        networkMismatch: false,
        noWalletOptions: null,
        dismissNoWalletPrompt: vi.fn(),
      };
    });
  });

  it('shows the truncated address while connected, then returns to Connect Wallet after clicking disconnect', async () => {
    const user = userEvent.setup();
    render(<ConnectWalletButton />);

    const disconnectButton = screen.getByRole('button', {
      name: `Connected as ${ADDRESS}. Click to disconnect.`,
    });
    expect(disconnectButton).toHaveTextContent(TRUNCATED);

    await user.click(disconnectButton);

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Connected as ${ADDRESS}. Click to disconnect.` }),
    ).not.toBeInTheDocument();
  });
});

describe('ConnectWalletButton connecting state', () => {
  // WalletProvider's own passive session-restore on mount deliberately
  // does NOT set `connecting` (see the "Connecting vs. restoring" note in
  // WalletProvider.tsx's docblock) — only an explicit connect() call
  // does. This covers the button's rendering contract for whenever the
  // provider does report connecting: true, which is what actually happens
  // during that explicit connect() call today.
  it('shows a non-interactive loading state instead of "Connect Wallet" while the wallet is connecting', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      connecting: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
      noWalletOptions: null,
      dismissNoWalletPrompt: vi.fn(),
    });

    render(<ConnectWalletButton />);

    // The connecting state renders as plain text (not a button), so there
    // is nothing clickable that could start a second connect() call.
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Wallet' })).not.toBeInTheDocument();
  });
});
