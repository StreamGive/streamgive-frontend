import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast/ToastProvider';

import { ConnectWalletButton } from './ConnectWalletButton';
import { useWallet, WalletProvider } from './WalletProvider';

const TEST_ADDRESS = 'G' + 'A'.repeat(55);
// Matches src/lib/stellar.ts's NETWORK_PASSPHRASE default, so tests don't
// have to set NEXT_PUBLIC_NETWORK_PASSPHRASE just to assert against it.
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const mockGetAddress = vi.fn();
const mockAuthModal = vi.fn();
const mockSignMessage = vi.fn();
// Defaults to the app's own configured network, i.e. "no mismatch" — tests
// that care about a mismatch override this per-test.
const mockGetNetwork = vi.fn().mockResolvedValue({
  network: 'TESTNET',
  networkPassphrase: NETWORK_PASSPHRASE,
});
// Defaults to "a wallet is installed" so existing connect-flow tests reach
// authModal() as before — the no-wallet-detected tests override this.
const mockGetSupportedWallets = vi.fn().mockResolvedValue([
  { id: 'freighter', name: 'Freighter', url: 'https://freighter.app', isAvailable: true },
]);

vi.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    getAddress: (...args: unknown[]) => mockGetAddress(...args),
    authModal: (...args: unknown[]) => mockAuthModal(...args),
    getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
    getSupportedWallets: (...args: unknown[]) => mockGetSupportedWallets(...args),
    signTransaction: vi.fn(),
    signMessage: (...args: unknown[]) => mockSignMessage(...args),
  },
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/utils', () => ({
  defaultModules: () => [],
}));

function renderButton() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <ConnectWalletButton />
      </WalletProvider>
    </ToastProvider>,
  );
}

/** Exposes signMessage's outcome as text, since no UI button triggers it
 * directly — WalletProvider's consumers (adminApi.ts) call it programmatically. */
function SignMessageProbe({ message }: { message: string }) {
  const { signMessage } = useWallet();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      onClick={() => {
        signMessage(message)
          .then(setResult)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }}
    >
      {error ? `Error: ${error}` : (result ?? 'Sign')}
    </button>
  );
}

/** Exposes networkMismatch as text, so the raw flag can be asserted next to
 * the "Wrong network" hint ConnectWalletButton derives from it. */
function NetworkMismatchProbe() {
  const { networkMismatch } = useWallet();
  return <span data-testid="network-mismatch">{String(networkMismatch)}</span>;
}

function renderButtonWithProbe() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <ConnectWalletButton />
        <NetworkMismatchProbe />
      </WalletProvider>
    </ToastProvider>,
  );
}

/** Exposes the raw address/connecting state, rather than inferring it from
 * which button label ConnectWalletButton happens to render. */
function WalletStateProbe() {
  const { address, connecting } = useWallet();
  return (
    <>
      <span data-testid="address">{address ?? 'null'}</span>
      <span data-testid="connecting">{String(connecting)}</span>
    </>
  );
}

function renderStateProbe() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <WalletStateProbe />
      </WalletProvider>
    </ToastProvider>,
  );
}

function renderSignMessageProbe(message = 'hello') {
  return render(
    <ToastProvider>
      <WalletProvider>
        <SignMessageProbe message={message} />
      </WalletProvider>
    </ToastProvider>,
  );
}

describe('wallet connect flow', () => {
  beforeEach(() => {
    mockGetAddress.mockReset();
    mockAuthModal.mockReset();
    mockGetNetwork.mockReset().mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASE,
    });
  });

  it('shows "Connect Wallet" when no session is restored', async () => {
    // getAddress() rejecting is the documented "nothing connected yet"
    // case — not an error, the common cold-start state.
    mockGetAddress.mockRejectedValue(new Error('not connected'));

    renderButton();

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('leaves address null and connecting false when session restore rejects, without an error toast', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));

    renderStateProbe();

    // `connecting` starts true (restore in progress) and must flip to
    // false once getAddress() settles, even though it rejected.
    expect(screen.getByTestId('connecting')).toHaveTextContent('true');
    expect(screen.getByTestId('address')).toHaveTextContent('null');

    await waitFor(() => expect(screen.getByTestId('connecting')).toHaveTextContent('false'));

    expect(screen.getByTestId('address')).toHaveTextContent('null');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('restores an already-authorized session on mount', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    renderButton();

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
  });

  it('flags a wrong network on a session restored on mount', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });
    mockGetNetwork.mockResolvedValueOnce({
      network: 'PUBLIC',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });

    renderButton();

    expect(await screen.findByText(/wrong network/i)).toBeInTheDocument();
  });

  it('re-checks the network when the window regains focus', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    // Finish session restoration and install the focus listener before
    // simulating a return to the tab.
    await act(async () => {
      renderButton();
    });

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
    expect(mockGetNetwork).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/wrong network/i)).not.toBeInTheDocument();

    mockGetNetwork.mockResolvedValueOnce({
      network: 'PUBLIC',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(await screen.findByText(/wrong network/i)).toBeInTheDocument();
    expect(mockGetNetwork).toHaveBeenCalledTimes(2);
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

  it('treats dismissing the wallet modal as a no-op without rejecting or toasting', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));
    // The kit rejects with a plain object, not an Error, on dismissal.
    mockAuthModal.mockRejectedValue({ code: -1, message: 'The user closed the modal.' });

    const user = userEvent.setup();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      renderButton();

      await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

      // Back to the idle "Connect Wallet" state, with no error feedback.
      expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('shows an error toast when connecting fails for another reason', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));
    mockAuthModal.mockRejectedValue(new Error('Wallet extension crashed'));

    const user = userEvent.setup();
    renderButton();

    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByText('Wallet extension crashed')).toBeInTheDocument();
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

describe('networkMismatch', () => {
  const OTHER_NETWORK = {
    network: 'PUBLIC',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  };

  beforeEach(() => {
    mockGetAddress.mockReset();
    mockAuthModal.mockReset();
    mockGetNetwork.mockClear();
    // Nothing to restore on mount: these tests connect through the modal.
    mockGetAddress.mockRejectedValue(new Error('not connected'));
    mockAuthModal.mockResolvedValue({ address: TEST_ADDRESS });
  });

  async function connectWallet() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));
    await screen.findByRole('button', { name: /connected as/i });
    return user;
  }

  it('is true, and the button shows "Wrong network", when the wallet reports a different passphrase', async () => {
    mockGetNetwork.mockResolvedValueOnce(OTHER_NETWORK);

    renderButtonWithProbe();
    await connectWallet();

    expect(screen.getByTestId('network-mismatch')).toHaveTextContent('true');
    expect(screen.getByText('Wrong network')).toBeInTheDocument();
  });

  it('is false, and no hint shows, when the wallet is on the matching network', async () => {
    mockGetNetwork.mockResolvedValueOnce({
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    renderButtonWithProbe();
    await connectWallet();

    expect(mockGetNetwork).toHaveBeenCalled();
    expect(screen.getByTestId('network-mismatch')).toHaveTextContent('false');
    expect(screen.queryByText('Wrong network')).not.toBeInTheDocument();
  });

  it('is false when the wallet cannot report its network', async () => {
    mockGetNetwork.mockRejectedValueOnce(new Error('getNetwork is not supported'));

    renderButtonWithProbe();
    await connectWallet();

    expect(screen.getByTestId('network-mismatch')).toHaveTextContent('false');
    expect(screen.queryByText('Wrong network')).not.toBeInTheDocument();
  });

  it('clears again after the wallet switches back to the matching network', async () => {
    mockGetNetwork.mockResolvedValueOnce(OTHER_NETWORK);

    renderButtonWithProbe();
    await connectWallet();
    expect(screen.getByText('Wrong network')).toBeInTheDocument();

    mockGetNetwork.mockResolvedValueOnce({
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('network-mismatch')).toHaveTextContent('false');
    });
    expect(screen.queryByText('Wrong network')).not.toBeInTheDocument();
  });

  it('is cleared on disconnect', async () => {
    mockGetNetwork.mockResolvedValueOnce(OTHER_NETWORK);

    renderButtonWithProbe();
    const user = await connectWallet();
    expect(screen.getByText('Wrong network')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /connected as/i }));

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByTestId('network-mismatch')).toHaveTextContent('false');
    expect(screen.queryByText('Wrong network')).not.toBeInTheDocument();
  });
});

describe('signMessage (SEP-53)', () => {
  beforeEach(() => {
    mockGetAddress.mockReset();
    mockSignMessage.mockReset();
    // Every test here needs an already-connected wallet — signMessage
    // throws locally, with no SDK call at all, when address is null.
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });
  });

  it('returns the signature and passes the connected address and network', async () => {
    mockSignMessage.mockResolvedValue({ signedMessage: 'c2lnbmVkLXBheWxvYWQ=' });

    const user = userEvent.setup();
    renderSignMessageProbe('sign-me');

    await user.click(await screen.findByRole('button', { name: 'Sign' }));

    expect(await screen.findByRole('button', { name: 'c2lnbmVkLXBheWxvYWQ=' })).toBeInTheDocument();
    expect(mockSignMessage).toHaveBeenCalledWith('sign-me', {
      address: TEST_ADDRESS,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
  });

  it('rejects when no wallet is connected, without calling the SDK', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));

    const user = userEvent.setup();
    renderSignMessageProbe();

    // Wait for the "not connected" restore attempt to settle before
    // clicking, so the assertion below isn't racing that in-flight effect.
    await waitFor(() => expect(mockGetAddress).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Sign' }));

    expect(
      await screen.findByRole('button', { name: /error: no wallet connected/i }),
    ).toBeInTheDocument();
    expect(mockSignMessage).not.toHaveBeenCalled();
  });
});
