'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { EmbedSnippet } from '@/components/ngoAdmin/EmbedSnippet';
import { WithdrawButton } from '@/components/ngoAdmin/WithdrawButton';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getNgos, getStreams, type Ngo, type Stream } from '@/lib/api';
import { formatAmount } from '@/lib/format';

export default function NgoAdminPage() {
  const { address, connect } = useWallet();
  // undefined = not looked up yet, null = this address isn't a verified NGO
  const [ngo, setNgo] = useState<Ngo | null | undefined>(undefined);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [detailsStream, setDetailsStream] = useState<Stream | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setNgo(undefined);
      setStreams([]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    try {
      // No "look up NGO by address" endpoint exists — only list-all and
      // get-by-id — so this scans the verified list client-side. Same
      // limitation as the platform impact page; fine at today's scale.
      const ngos = await getNgos();
      const match = ngos.find((n) => n.ownerAddress === address) ?? null;
      setNgo(match);
      setStreams(match ? await getStreams({ ngo: match.id }) : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">NGO admin</h1>

        {!address && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600">Connect your NGO&apos;s wallet to manage your streams.</p>
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500">
            Loading…
          </p>
        )}

        {address && !loading && loadError && (
          <p className="mt-8 text-red-600">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {address && !loading && !loadError && ngo === null && (
          <p className="mt-8 text-gray-600">
            This wallet isn&apos;t registered as a verified NGO yet.{' '}
            <Link href="/apply" className="underline">
              Apply here
            </Link>
            .
          </p>
        )}

        {address && !loading && !loadError && ngo && (
          <>
            <p className="mt-2 text-gray-600">Managing streams for {ngo.name}.</p>

            <EmbedSnippet ngoId={ngo.id} />

            {streams.length === 0 ? (
              <p className="mt-8 text-gray-600">No one has started a stream to you yet.</p>
            ) : (
              <ul className="mt-8 space-y-4">
                {streams.map((stream) => (
                  <li key={stream.id} className="rounded-lg border border-gray-200 p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-mono text-sm break-all">{stream.donor.address}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'} · Balance{' '}
                          {formatAmount(stream.balance)} · Withdrawn {formatAmount(stream.withdrawn)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailsStream(stream)}
                          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                          View details
                        </button>
                        {stream.status === 'ACTIVE' && (
                          <WithdrawButton
                            streamOnChainId={stream.onChainId}
                            onWithdrawn={() => void refresh()}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
