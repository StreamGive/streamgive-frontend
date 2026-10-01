import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

/**
 * IS_MAINNET (and everything EnvironmentBanner derives from it) is
 * computed once at module load from process.env, mirroring the pattern
 * already used in src/lib/stellar.test.ts — re-importing after stubbing
 * the env var is the only way to exercise both networks in the same test
 * file.
 */
async function freshEnvironmentBanner(networkPassphrase: string) {
  vi.stubEnv('NEXT_PUBLIC_NETWORK_PASSPHRASE', networkPassphrase);
  vi.resetModules();
  const { EnvironmentBanner } = await import('./EnvironmentBanner');
  return EnvironmentBanner;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('EnvironmentBanner', () => {
  it('shows a testnet warning when not on mainnet', async () => {
    const EnvironmentBanner = await freshEnvironmentBanner(TESTNET_PASSPHRASE);
    render(<EnvironmentBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent(/testnet mode/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/not real money/i);
  });

  it('renders nothing on mainnet', async () => {
    const EnvironmentBanner = await freshEnvironmentBanner(MAINNET_PASSPHRASE);
    const { container } = render(<EnvironmentBanner />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
