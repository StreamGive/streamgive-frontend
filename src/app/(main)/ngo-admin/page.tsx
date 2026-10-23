'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { DonateQrCode } from '@/components/ngos/DonateQrCode';
import { EmbedSnippet } from '@/components/ngoAdmin/EmbedSnippet';
import { NgoAdminStreamList } from '@/components/ngoAdmin/NgoAdminStreamList';
import { WithdrawalHistory } from '@/components/ngoAdmin/WithdrawalHistory';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getStreams, lookupNgoByAddress, type Ngo, type Stream } from '@/lib/api';
import { formatTokenTotals } from '@/lib/format';
import { useLatestRequest } from '@/lib/useLatestRequest';

export default function NgoAdminPage() {
  const { address } = useWallet();
  // undefined = not looked up yet, null = this address has no NGO record at all
  const [ngo, setNgo] = useState<Ngo | null | undefined>(undefined);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [detailsStream, setDetailsStream] = useState<Stream | null>(null);

  // Drop any NGO match/streams fetched under a previous address as soon as
  // `address` changes, during render rather than in an effect, so stale data
  // from the old wallet is never painted (even briefly) under the new one.
  const [prevAddress, setPrevAddress] = useState(address);
  if (address !== prevAddress) {
    setPrevAddress(address);
    setNgo(undefined);
    setStreams([]);
    setLoadError(false);
  }

  // Only the most recently started refresh may write state, so a slow
  // response for a previous wallet can't land after, and overwrite, newer data.
  const { begin, cancel } = useLatestRequest();

  const refresh = useCallback(async () => {
    if (!address) {
      cancel();
      setNgo(undefined);
      setStreams([]);
      return;
    }

    const request = begin();
    setLoading(true);
    setLoadError(false);
    try {
      // /ngos/lookup also returns unverified NGOs, so an applicant waiting
      // on review can be told that instead of being sent to apply again.
      const match = await lookupNgoByAddress(address);
      if (!request.isCurrent()) return;
      const nextStreams = match?.verified
        ? await getStreams({ ngo: match.id }, request.signal)
        : [];
      if (!request.isCurrent()) return;
      setNgo(match);
      setStreams(nextStreams);
    } catch {
      if (request.isCurrent()) setLoadError(true);
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [address, begin, cancel]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const totalWithdrawn = formatTokenTotals(
    streams.map((s) => ({ tokenAddress: s.tokenAddress, raw: BigInt(s.withdrawn) })),
  );
  const remainingBalance = formatTokenTotals(
    streams
      .filter((s) => s.status === 'ACTIVE')
      .map((s) => ({ tokenAddress: s.tokenAddress, raw: BigInt(s.balance) })),
  );
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;

  return (
    <>
      <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">NGO admin</h1>

        {!address && (
          <ConnectWalletPrompt
            className="mt-8"
            message="Connect your NGO's wallet to manage your streams."
          />
        )}

        {/* Only the very first load has nothing to show yet — a refresh
            triggered after a withdrawal keeps whatever's already rendered
            on screen (the embed snippet, QR code, open modal, etc.)
            mounted while it runs in the background. */}
        {address && loading && ngo === undefined && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {address && loadError && ngo === undefined && (
          <div className="mt-8">
            <p className="text-red-600 dark:text-red-400">
              Couldn&apos;t load your NGO data. Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* A background refresh failing must not blank out data we already
            have — same reasoning as the impact page's poll failures. */}
        {address && loadError && ngo !== undefined && (
          <p role="status" className="mt-8 text-sm text-amber-700 dark:text-amber-400">
            Couldn&apos;t refresh — showing the last data we loaded.
          </p>
        )}

        {address && ngo === null && (
          <p className="mt-8 text-gray-600">
            This wallet isn&apos;t registered as an NGO yet.{' '}
            <Link href="/apply" className="underline">
              Apply here
            </Link>
            .
          </p>
        )}

        {address && ngo && !ngo.verified && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6">
            <p className="font-medium">Your application is awaiting review.</p>
            <p className="mt-1 text-sm text-gray-600">
              We&apos;ve received the application for {ngo.name}. You&apos;ll be able to manage
              streams here once it&apos;s verified.
            </p>
          </div>
        )}

        {address && ngo?.verified && (
          <>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Managing streams for {ngo.name}.
            </p>

            <div className="flex flex-wrap items-start gap-8">
              <EmbedSnippet ngoId={ngo.id} />
              <DonateQrCode ngoId={ngo.id} ngoName={ngo.name} />
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Total withdrawn</dt>
                <dd className="text-lg font-semibold">{totalWithdrawn}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Remaining balance</dt>
                <dd className="text-lg font-semibold">{remainingBalance}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
                <dd className="text-lg font-semibold">{activeCount}</dd>
              </div>
            </dl>

            <NgoAdminStreamList
              streams={streams}
              onWithdrawn={() => void refresh()}
              onViewDetails={setDetailsStream}
            />

            <WithdrawalHistory ngoId={ngo.id} />
          </>
        )}
      </main>

      {detailsStream && (
        <StreamDetailsModal stream={detailsStream} onClose={() => setDetailsStream(null)} />
      )}
    </>
  );
}
