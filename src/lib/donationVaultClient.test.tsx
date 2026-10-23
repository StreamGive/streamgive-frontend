import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADDRESS = 'G' + 'D'.repeat(55);

// vi.mock factories are hoisted above imports, so anything they reference
// has to go through vi.hoisted to avoid a TDZ error.
const { showToast, clientFrom, signTransaction } = vi.hoisted(() => ({
  showToast: vi.fn(),
  clientFrom: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk/contract', () => ({
  Client: { from: (...args: unknown[]) => clientFrom(...args) },
}));

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({ address: ADDRESS, signTransaction }),
}));

vi.mock('./stellar', () => ({
  DONATION_VAULT_CONTRACT_ID: 'CVAULTFAKE',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  SOROBAN_RPC_URL: 'https://example.invalid',
}));

/**
 * donationVaultClient.ts keeps its shared-client cache in a module-level
 * variable, so each test re-imports a fresh instance of the module (the
 * same trick stellar.test.ts uses for its env-dependent constants) rather
 * than letting one test's cached client leak into the next.
 */
async function freshDonationVaultClient() {
  vi.resetModules();
  return import('./donationVaultClient');
}

// Stands in for StreamControls/WithdrawButton: a page with N stream rows
// renders N components that each call useDonationVaultClient (issue #202).
function Probe({
  useDonationVaultClient,
}: {
  useDonationVaultClient: () => unknown;
}) {
  useDonationVaultClient();
  return null;
}

describe('useDonationVaultClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shares a single Client.from() call across multiple rows for the same signer', async () => {
    const { useDonationVaultClient } = await freshDonationVaultClient();
    // Never resolves -- this test only cares how many times Client.from was
    // called while every row's fetch is in flight, which is when N separate
    // per-row fetches (the bug) would already show up as N calls.
    clientFrom.mockReturnValue(new Promise(() => {}));

    render(
      <>
        <Probe useDonationVaultClient={useDonationVaultClient} />
        <Probe useDonationVaultClient={useDonationVaultClient} />
        <Probe useDonationVaultClient={useDonationVaultClient} />
      </>,
    );

    expect(clientFrom).toHaveBeenCalledTimes(1);
  });

  it('shows at most one error toast when initialisation fails for several rows', async () => {
    const { useDonationVaultClient } = await freshDonationVaultClient();
    clientFrom.mockRejectedValue(new Error('RPC unreachable'));

    render(
      <>
        <Probe useDonationVaultClient={useDonationVaultClient} />
        <Probe useDonationVaultClient={useDonationVaultClient} />
        <Probe useDonationVaultClient={useDonationVaultClient} />
      </>,
    );

    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(clientFrom).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('shows a user-friendly toast instead of the raw error, and logs the real one to the console', async () => {
    const { useDonationVaultClient } = await freshDonationVaultClient();
    // Stands in for the actual failure this was reported against — a
    // missing NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID throws exactly this
    // developer-facing message from getDonationVaultClient.
    const devError = new Error('NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID is not set');
    clientFrom.mockRejectedValue(devError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<Probe useDonationVaultClient={useDonationVaultClient} />);

    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(showToast).toHaveBeenCalledWith(
      'error',
      "Couldn't reach the donation contract. Please try again shortly.",
    );
    expect(showToast).not.toHaveBeenCalledWith(
      'error',
      expect.stringContaining('NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID'),
    );
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), devError);

    consoleError.mockRestore();
  });
});
