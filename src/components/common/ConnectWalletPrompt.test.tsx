import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWallet } from '@/components/wallet/WalletProvider';

import { ConnectWalletPrompt } from './ConnectWalletPrompt';

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: vi.fn(),
}));

const mockUseWallet = vi.mocked(useWallet);

describe('ConnectWalletPrompt', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      address: null,
      connecting: false,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
      noWalletOptions: null,
      dismissNoWalletPrompt: vi.fn(),
    });
  });

  it('shows the supplied message and connects when the button is clicked', () => {
    const { connect } = mockUseWallet();
    const message = 'Connect your wallet to view your streams.';

    render(<ConnectWalletPrompt message={message} />);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Wallet' }));

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('shows a loading status while the wallet session is restoring', () => {
    mockUseWallet.mockReturnValue({ ...mockUseWallet(), connecting: true });
    const message = 'Connect your wallet to view your streams.';

    render(<ConnectWalletPrompt message={message} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Wallet' })).not.toBeInTheDocument();
  });
});
