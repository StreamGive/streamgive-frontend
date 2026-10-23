// @vitest-environment node

import type { Transaction } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Keep real transaction construction while replacing the RPC boundary.
// ESM namespace exports cannot be reassigned with vi.spyOn.
const { simulateTransaction, scValToNative, isSimulationError } = vi.hoisted(() => ({
  simulateTransaction: vi.fn<
    (transaction: Transaction) => Promise<{ error?: string; result?: { retval: unknown } }>
  >(),
  scValToNative: vi.fn<(...args: unknown[]) => bigint>(),
  isSimulationError: vi.fn<(...args: unknown[]) => boolean>(),
}));

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    scValToNative,
    rpc: {
      ...actual.rpc,
      Server: class {
        simulateTransaction = simulateTransaction;
      },
      Api: { ...actual.rpc.Api, isSimulationError },
    },
  };
});

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

// A valid-looking dummy Stellar public key (same one stellar.ts uses
// internally as the throwaway simulation source account).
const SIMULATION_SOURCE_ACCOUNT =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TOKEN_ADDRESS = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const WALLET_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

// Stellar Asset Contract addresses are StrKey-encoded: 56 characters,
// base32 alphabet, starting with the 'C' (contract) version byte.
const CONTRACT_ADDRESS_RE = /^C[A-Z2-7]{55}$/;

/**
 * NETWORK_PASSPHRASE, and everything derived from it, is computed once at
 * module load from process.env. Re-importing after stubbing the env var is
 * the only way to exercise both networks in the same test file.
 */
async function freshStellar(networkPassphrase: string) {
  vi.stubEnv('NEXT_PUBLIC_NETWORK_PASSPHRASE', networkPassphrase);
  vi.resetModules();
  return import('./stellar');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('explorerUrl', () => {
  it('links to a testnet account', async () => {
    const { explorerUrl } = await freshStellar(TESTNET_PASSPHRASE);
    expect(explorerUrl('account', 'GADDRESS')).toBe(
      'https://stellar.expert/explorer/testnet/account/GADDRESS',
    );
  });

  it('links to a testnet contract', async () => {
    const { explorerUrl } = await freshStellar(TESTNET_PASSPHRASE);
    expect(explorerUrl('contract', 'CADDRESS')).toBe(
      'https://stellar.expert/explorer/testnet/contract/CADDRESS',
    );
  });

  it('links to a testnet transaction', async () => {
    const { explorerUrl } = await freshStellar(TESTNET_PASSPHRASE);
    expect(explorerUrl('transaction', 'TXHASH123')).toBe(
      'https://stellar.expert/explorer/testnet/tx/TXHASH123',
    );
    expect(explorerUrl('tx', 'TXHASH123')).toBe(
      'https://stellar.expert/explorer/testnet/tx/TXHASH123',
    );
  });

  it('links to a mainnet account', async () => {
    const { explorerUrl } = await freshStellar(MAINNET_PASSPHRASE);
    expect(explorerUrl('account', 'GADDRESS')).toBe(
      'https://stellar.expert/explorer/public/account/GADDRESS',
    );
  });

  it('links to a mainnet contract', async () => {
    const { explorerUrl } = await freshStellar(MAINNET_PASSPHRASE);
    expect(explorerUrl('contract', 'CADDRESS')).toBe(
      'https://stellar.expert/explorer/public/contract/CADDRESS',
    );
  });

  it('links to a mainnet transaction', async () => {
    const { explorerUrl } = await freshStellar(MAINNET_PASSPHRASE);
    expect(explorerUrl('transaction', 'TXHASH123')).toBe(
      'https://stellar.expert/explorer/public/tx/TXHASH123',
    );
    expect(explorerUrl('tx', 'TXHASH123')).toBe(
      'https://stellar.expert/explorer/public/tx/TXHASH123',
    );
  });
});

describe('IS_MAINNET', () => {
  it('is false on testnet', async () => {
    const { IS_MAINNET } = await freshStellar(TESTNET_PASSPHRASE);
    expect(IS_MAINNET).toBe(false);
  });

  it('is true on mainnet', async () => {
    const { IS_MAINNET } = await freshStellar(MAINNET_PASSPHRASE);
    expect(IS_MAINNET).toBe(true);
  });
});

describe('getNativeAssetAddress', () => {
  it('returns a valid 56-character contract address on testnet', async () => {
    const { getNativeAssetAddress } = await freshStellar(TESTNET_PASSPHRASE);
    const address = getNativeAssetAddress();
    expect(address).toHaveLength(56);
    expect(address).toMatch(CONTRACT_ADDRESS_RE);
  });

  it('returns a valid 56-character contract address on mainnet', async () => {
    const { getNativeAssetAddress } = await freshStellar(MAINNET_PASSPHRASE);
    const address = getNativeAssetAddress();
    expect(address).toHaveLength(56);
    expect(address).toMatch(CONTRACT_ADDRESS_RE);
  });

  it('differs between testnet and mainnet', async () => {
    const { getNativeAssetAddress: testnetAddress } = await freshStellar(TESTNET_PASSPHRASE);
    const testnet = testnetAddress();
    const { getNativeAssetAddress: mainnetAddress } = await freshStellar(MAINNET_PASSPHRASE);
    const mainnet = mainnetAddress();
    expect(testnet).not.toBe(mainnet);
  });
});

describe('getUsdcAssetAddress', () => {
  it('returns a valid 56-character contract address on testnet', async () => {
    const { getUsdcAssetAddress } = await freshStellar(TESTNET_PASSPHRASE);
    const address = getUsdcAssetAddress();
    expect(address).toHaveLength(56);
    expect(address).toMatch(CONTRACT_ADDRESS_RE);
  });

  it('returns a valid 56-character contract address on mainnet', async () => {
    const { getUsdcAssetAddress } = await freshStellar(MAINNET_PASSPHRASE);
    const address = getUsdcAssetAddress();
    expect(address).toHaveLength(56);
    expect(address).toMatch(CONTRACT_ADDRESS_RE);
  });

  it('differs from the native asset address', async () => {
    const { getNativeAssetAddress, getUsdcAssetAddress } = await freshStellar(TESTNET_PASSPHRASE);
    expect(getUsdcAssetAddress()).not.toBe(getNativeAssetAddress());
  });
});

describe('getTokenBalance', () => {
  beforeEach(() => {
    simulateTransaction.mockReset();
    scValToNative.mockReset().mockReturnValue(42n);
    isSimulationError.mockReset().mockReturnValue(false);
  });

  it('returns the balance string on a successful simulation', async () => {
    const retval = {};
    simulateTransaction.mockResolvedValue({ result: { retval } });
    scValToNative.mockReturnValue(5_000_000_000n);

    const { getTokenBalance } = await freshStellar(TESTNET_PASSPHRASE);
    const result = await getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);

    expect(result).toBe('5000000000');
    expect(scValToNative).toHaveBeenCalledWith(retval);
  });

  it('rejects when the simulation reports an error, instead of returning null', async () => {
    simulateTransaction.mockResolvedValue({ error: 'contract trap' });
    isSimulationError.mockReturnValue(true);

    const { getTokenBalance } = await freshStellar(TESTNET_PASSPHRASE);
    await expect(getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS)).rejects.toThrow();
    expect(scValToNative).not.toHaveBeenCalled();
  });

  it('rejects when the simulation succeeds but has no result', async () => {
    simulateTransaction.mockResolvedValue({});

    const { getTokenBalance } = await freshStellar(TESTNET_PASSPHRASE);
    await expect(getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS)).rejects.toThrow();
    expect(scValToNative).not.toHaveBeenCalled();
  });

  // The RPC outage / wrong-network case: simulateTransaction itself throws,
  // as opposed to resolving with a simulation-level error above — both must
  // reject distinguishably rather than collapsing to the same "null" a
  // caller can't tell apart from a genuine zero balance.
  it('propagates the error when simulateTransaction itself throws', async () => {
    simulateTransaction.mockRejectedValue(new Error('network error'));

    const { getTokenBalance } = await freshStellar(TESTNET_PASSPHRASE);
    await expect(getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS)).rejects.toThrow('network error');
    expect(scValToNative).not.toHaveBeenCalled();
  });

  it('builds the transaction from the dummy source account (sequence 0)', async () => {
    simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const { getTokenBalance } = await freshStellar(TESTNET_PASSPHRASE);
    await getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);

    expect(simulateTransaction).toHaveBeenCalledOnce();
    const [transaction] = simulateTransaction.mock.calls[0];
    // TransactionBuilder increments the source account's initial sequence.
    expect(transaction.sequence).toBe('1');
  });

  it('uses SIMULATION_SOURCE_ACCOUNT as the dummy source', async () => {
    simulateTransaction.mockResolvedValue({ result: { retval: {} } });

    const { getTokenBalance } = await freshStellar(TESTNET_PASSPHRASE);
    await getTokenBalance(TOKEN_ADDRESS, WALLET_ADDRESS);

    expect(simulateTransaction).toHaveBeenCalledOnce();
    const [transaction] = simulateTransaction.mock.calls[0];
    expect(transaction.source).toBe(SIMULATION_SOURCE_ACCOUNT);
  });
});
