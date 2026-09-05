'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useWallet } from '@/components/wallet/WalletProvider';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getStreams, type Stream } from '@/lib/api';
import { formatAmount } from '@/lib/format';

export default function DashboardPage() {
  const { address, connect } = useWallet();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!address) {
      setStreams([]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    getStreams(address)
      .then(setStreams)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [address]);

  const totalCommitted = streams.reduce(
    (sum, s) => sum + BigInt(s.balance) + BigInt(s.withdrawn),
    0n,
  );
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Your donations</h1>

        {!address && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600">Connect your wallet to see your streams.</p>
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {address && loading && <p className="mt-8 text-gray-500">Loading your streams…</p>}

        {address && !loading && loadError && (
          <p className="mt-8 text-red-600">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {address && !loading && !loadError && streams.length === 0 && (
          <p className="mt-8 text-gray-600">
            You haven&apos;t started any streams yet.{' '}
            <Link href="/ngos" className="underline">
              Explore NGOs
            </Link>
            .
          </p>
        )}

        {address && !loading && !loadError && streams.length > 0 && (
          <>
            <dl className="mt-8 grid grid-cols-2 gap-6 sm:w-fit sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Total committed</dt>
                <dd className="text-lg font-semibold">{formatAmount(totalCommitted.toString())}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Active streams</dt>
                <dd className="text-lg font-semibold">{activeCount}</dd>
              </div>
            </dl>

            <ul className="mt-8 space-y-4">
              {streams.map((stream) => (
                <li key={stream.id} className="rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Link
                        href={`/ngos/${stream.ngo.id}`}
                        className="font-semibold hover:underline"
                      >
                        {stream.ngo.name}
                      </Link>
                      <p className="mt-1 text-sm text-gray-500">
                        {stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'} · Balance{' '}
                        {formatAmount(stream.balance)} · Withdrawn {formatAmount(stream.withdrawn)}
                      </p>
                    </div>
                    {stream.status === 'ACTIVE' && (
                      <div className="flex shrink-0 gap-2">
                        {/* Wired up in the next commit. */}
                        <button
                          type="button"
                          disabled
                          title="Coming soon"
                          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                          Top up
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Coming soon"
                          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
