'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { DonateQrCode } from '@/components/ngos/DonateQrCode';
import { EmbedSnippet } from '@/components/ngoAdmin/EmbedSnippet';
import { NgoAdminStreamList } from '@/components/ngoAdmin/NgoAdminStreamList';
import { WithdrawalHistory } from '@/components/ngoAdmin/WithdrawalHistory';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getStreams, lookupNgoByAddress, type Ngo, type Stream } from '@/lib/api';
import { formatAmount } from '@/lib/format';

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

  const refresh = useCallback(async () => {
    if (!address) {
      setNgo(undefined);
      setStreams([]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    try {
      // /ngos/lookup also returns unverified NGOs, so an applicant waiting
      // on review can be told that instead of being sent to apply again.
      const match = await lookupNgoByAddress(address);
      setNgo(match);
      setStreams(match?.verified ? await getStreams({ ngo: match.id }) : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const totalWithdrawn = streams.reduce((sum, s) => sum + BigInt(s.withdrawn), 0n);
  const remainingBalance = streams.reduce((sum, s) => sum + (s.status === 'ACTIVE' ? BigInt(s.balance) : 0n), 0n);
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;

  return (
    <>
      <Header />
      <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">NGO admin</h1>

        {!address && (
          <ConnectWalletPrompt
            className="mt-8"
            message="Connect your NGO's wallet to manage your streams."
          />
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {address && !loading && loadError && (
          <p className="mt-8 text-red-600 dark:text-red-400">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {address && !loading && !loadError && ngo === null && (
          <p className="mt-8 text-gray-600">
            This wallet isn&apos;t registered as an NGO yet.{' '}
            <Link href="/apply" className="underline">
              Apply here
            </Link>
            .
          </p>
        )}

        {address && !loading && !loadError && ngo && !ngo.verified && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6">
            <p className="font-medium">Your application is awaiting review.</p>
            <p className="mt-1 text-sm text-gray-600">
              We&apos;ve received the application for {ngo.name}. You&apos;ll be able to manage
              streams here once it&apos;s verified.
            </p>
          </div>
        )}

        {address && !loading && !loadError && ngo?.verified && (
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
                <dd className="text-lg font-semibold">{formatAmount(totalWithdrawn.toString())}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Remaining balance</dt>
                <dd className="text-lg font-semibold">{formatAmount(remainingBalance.toString())}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
                <dd className="text-lg font-semibold">{activeCount}</dd>
              </div>
            </dl>

            <EmbedSnippet ngoId={ngo.id} />

            <NgoAdminStreamList
              streams={streams}
              onWithdrawn={() => void refresh()}
              onViewDetails={setDetailsStream}
            />

            <WithdrawalHistory ngoId={ngo.id} />
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
