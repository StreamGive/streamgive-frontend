const PUBLIC_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

function getNetworkName(): string {
  const passphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? DEFAULT_NETWORK_PASSPHRASE;
  return passphrase === PUBLIC_NETWORK_PASSPHRASE ? 'Mainnet' : 'Testnet';
}

/**
 * A persistent, impossible-to-miss banner shown on every page whenever the
 * app isn't pointed at Stellar's mainnet, so donors never mistake a
 * testnet (or other non-mainnet) transaction for one moving real funds.
 *
 * Hidden entirely on mainnet. Uses the same amber "caution" treatment as
 * the rest of the app's warning UI (see the donate form's "Widget not
 * configured" notice and the impact page's stale-data notice) rather than
 * the red used for hard errors, since this isn't a failure state.
 */
export function EnvironmentBanner() {
  const networkName = getNetworkName();

  if (networkName === 'Mainnet') {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-100 px-6 py-2 text-center text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    >
      {networkName} mode: transactions use test funds, not real money.
    </div>
  );
}
