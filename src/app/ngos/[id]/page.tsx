import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { getNgo, getStreams, type NgoProfile, type Stream } from '@/lib/api';
import { formatAmount, truncateAddress } from '@/lib/format';
import { explorerUrl } from '@/lib/stellar';

const RECENT_STREAMS_LIMIT = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

type Props = { params: Promise<{ id: string }> };

// Next.js dedupes identical fetch() calls made during the same request, so
// this doesn't cost a second network round-trip on top of the page itself.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ngo = await getNgo(id).catch(() => null);

  if (!ngo) {
    return { title: 'NGO not found' };
  }

  return {
    title: ngo.name,
    description: `Support ${ngo.name} with a recurring, streaming donation on Stellar.`,
  };
}

export default async function NgoProfilePage({ params }: Props) {
  const { id } = await params;

  let ngo: NgoProfile | null;
  try {
    ngo = await getNgo(id);
  } catch {
    return (
      <>
        <Header />
        <main className="px-6 py-16 sm:px-12">
          <p className="text-red-600 dark:text-red-400">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        </main>
        <Footer />
      </>
    );
  }

  if (!ngo) {
    notFound();
  }

  // The API has no "most recent first" ordering guarantee, so that's
  // enforced here rather than trusting response order.
  const streams = await getStreams({ ngo: ngo.id }).catch((): Stream[] => []);
  const recentStreams = [...streams]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_STREAMS_LIMIT);

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{ngo.name}</h1>
          {ngo.verified && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
              Verified
            </span>
          )}
          <CopyLinkButton />
        </div>

        <a
          href={explorerUrl('account', ngo.ownerAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block break-all font-mono text-xs text-gray-500 underline dark:text-gray-400"
        >
          {ngo.ownerAddress}
        </a>

        <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
            <dd className="text-lg font-semibold">{ngo.stats.totalCommitted}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Total withdrawn</dt>
            <dd className="text-lg font-semibold">{ngo.stats.totalWithdrawn}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
            <dd className="text-lg font-semibold">{ngo.stats.activeStreamCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Donors</dt>
            <dd className="text-lg font-semibold">{ngo.stats.donorCount}</dd>
          </div>
        </dl>

        <Link
          href={`/ngos/${ngo.id}/donate`}
          className="mt-10 inline-block rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          Start streaming
        </Link>

        <h2 className="mt-12 text-lg font-semibold">Recent streams</h2>
        {recentStreams.length === 0 ? (
          <p className="mt-2 text-gray-600 dark:text-gray-400">No streams yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentStreams.map((stream) => (
              <li
                key={stream.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-800"
              >
                <a
                  href={explorerUrl('account', stream.donor.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline"
                >
                  {truncateAddress(stream.donor.address)}
                </a>
                <span className="text-gray-500 dark:text-gray-400">
                  {formatAmount(stream.rate)} / second
                </span>
                <span
                  className={
                    stream.status === 'ACTIVE'
                      ? 'font-medium text-green-700 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }
                >
                  {stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {formatDate(stream.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
