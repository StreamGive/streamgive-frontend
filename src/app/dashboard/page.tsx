'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { StreamControls } from '@/components/dashboard/StreamControls';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getStreams, type Stream } from '@/lib/api';
import { buildDonationHistoryCsv } from '@/lib/csv';
import { formatAmount } from '@/lib/format';

function downloadDonationHistoryCsv(streams: Stream[]): void {
  const blob = new Blob([buildDonationHistoryCsv(streams)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'streamgive-donations.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const { address, connect } = useWallet();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [detailsStream, setDetailsStream] = useState<Stream | null>(null);

  const refresh = useCallback(() => {
    if (!address) {
      setStreams([]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    getStreams({ donor: address })
      .then(setStreams)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const totalCommitted = streams.reduce(
    (sum, s) => sum + BigInt(s.balance) + BigInt(s.withdrawn),
    0n,
  );
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;

  return (
    <>
      <Header />
      <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Your donations</h1>

        {!address && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Connect your wallet to see your streams.</p>
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading your streams…
          </p>
        )}

        {address && !loading && loadError && (
          <p className="mt-8 text-red-600 dark:text-red-400">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {address && !loading && !loadError && streams.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">
            You haven&apos;t started any streams yet.{' '}
            <Link href="/ngos" className="underline">
              Explore NGOs
            </Link>
            .
          </p>
        )}

        {address && !loading && !loadError && streams.length > 0 && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <dl className="grid grid-cols-2 gap-6 sm:w-fit sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
                  <dd className="text-lg font-semibold">
                    {formatAmount(totalCommitted.toString())}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
                  <dd className="text-lg font-semibold">{activeCount}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => downloadDonationHistoryCsv(streams)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Export CSV
              </button>
            </div>

            <ul className="mt-8 space-y-4">
              {streams.map((stream) => (
                <li
                  key={stream.id}
                  className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link
                        href={`/ngos/${stream.ngo.id}`}
                        className="font-semibold hover:underline"
                      >
                        {stream.ngo.name}
                      </Link>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'} · Balance{' '}
                        {formatAmount(stream.balance)} · Withdrawn {formatAmount(stream.withdrawn)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailsStream(stream)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        View details
                      </button>
                      {stream.status === 'ACTIVE' && (
                        <StreamControls stream={stream} onChanged={refresh} />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />

      {detailsStream && (
        <StreamDetailsModal stream={detailsStream} onClose={() => setDetailsStream(null)} />
      )}
    </>
  );
}
