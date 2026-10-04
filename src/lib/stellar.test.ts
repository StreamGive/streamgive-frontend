import { afterEach, describe, expect, it, vi } from 'vitest';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

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
