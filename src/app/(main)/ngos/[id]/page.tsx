import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { DonateQrCode } from '@/components/ngos/DonateQrCode';
import { getNgo, getStreams, type NgoProfile, type Stream } from '@/lib/api';
import { formatAmount, formatDate, formatTokenAmount, truncateAddress } from '@/lib/format';
import { explorerUrl } from '@/lib/stellar';

const RECENT_STREAMS_LIMIT = 10;

/** Only http(s) URLs are rendered as links, so a stored `javascript:` or
 * other scheme can never become a clickable href. */
function safeWebsiteUrl(website: string): string | null {
  try {
    const url = new URL(website);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
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

  const description = `Support ${ngo.name} with a recurring, streaming donation on Stellar.`;
  // Relative — resolved against metadataBase (the root layout sets it to
  // NEXT_PUBLIC_APP_URL), same as the root layout's own openGraph/twitter.
  const profileUrl = `/ngos/${id}`;

  return {
    title: ngo.name,
    description,
    alternates: {
      canonical: profileUrl,
    },
    openGraph: {
      title: ngo.name,
      description,
      type: 'website',
      url: profileUrl,
      // /opengraph-image is the site-wide share image (src/app/opengraph-image.tsx)
      // — there's no per-NGO image to generate one from, so every profile
      // shares it rather than going without a preview image at all.
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'StreamGive' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ngo.name,
      description,
      images: ['/opengraph-image'],
    },
  };
}

export default async function NgoProfilePage({ params }: Props) {
  const { id } = await params;

  let ngo: NgoProfile | null;
  try {
    ngo = await getNgo(id);
  } catch {
    return (
      <main id="main" className="px-6 py-16 sm:px-12">
        <p className="text-red-600 dark:text-red-400">
          Couldn&apos;t load this NGO&apos;s profile. Please check your connection and try again.
        </p>
        <Link
          href={`/ngos/${id}`}
          className="mt-3 inline-block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Retry
        </Link>
      </main>
    );
  }

  if (!ngo) {
    notFound();
  }

  const websiteUrl = ngo.website ? safeWebsiteUrl(ngo.website) : null;

  // The API has no "most recent first" ordering guarantee, so that's
  // enforced here rather than trusting response order. The limit still
  // keeps the request itself small on NGOs with a long stream history —
  // this only re-sorts whatever page comes back, not the full history.
  const streams = await getStreams({ ngo: ngo.id, limit: RECENT_STREAMS_LIMIT }).catch(
    (): Stream[] => [],
  );
  const recentStreams = [...streams].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <main id="main" className="px-6 py-16 sm:px-12">
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

        {ngo.description && (
          <p className="mt-6 max-w-2xl whitespace-pre-line text-gray-700 dark:text-gray-300">
            {ngo.description}
          </p>
        )}

        {(websiteUrl || ngo.country) && (
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            {websiteUrl && (
              <li>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {websiteUrl}
                </a>
              </li>
            )}
            {ngo.country && <li>{ngo.country}</li>}
          </ul>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
            <dd className="text-lg font-semibold">{formatAmount(ngo.stats.totalCommitted)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500 dark:text-gray-400">Total withdrawn</dt>
            <dd className="text-lg font-semibold">{formatAmount(ngo.stats.totalWithdrawn)}</dd>
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

        <div className="mt-10 flex flex-wrap items-start gap-8">
          {ngo.verified && (
            <Link
              href={`/ngos/${ngo.id}/donate`}
              className="inline-block rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Start streaming
            </Link>
          )}

          <DonateQrCode ngoId={ngo.id} ngoName={ngo.name} />
        </div>

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
                  {formatTokenAmount(stream.rate, stream.tokenAddress)} / second
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
  );
}
