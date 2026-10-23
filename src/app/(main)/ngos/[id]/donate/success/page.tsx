import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { getNgo, getStreams, type NgoProfile } from '@/lib/api';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ streamId?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ngo = await getNgo(id).catch(() => null);
  return {
    title: ngo ? `Stream started — ${ngo.name}` : 'NGO not found',
    robots: { index: false, follow: false },
  };
}

export default async function DonateSuccessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { streamId } = await searchParams;

  let ngo: NgoProfile | null;
  try {
    ngo = await getNgo(id);
  } catch {
    return (
      <main id="main" className="px-6 py-16 sm:px-12">
        <p className="text-red-600 dark:text-red-400">
          Couldn&apos;t load this page. Please check your connection and try again.
        </p>
        <Link
          href={`/ngos/${id}/donate/success${streamId ? `?streamId=${streamId}` : ''}`}
          className="mt-3 inline-block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Retry
        </Link>
      </main>
    );
  }

  // notFound() works by throwing, so it has to stay outside the try/catch
  // above or the catch would swallow it and show the API error instead.
  if (!ngo) {
    notFound();
  }

  const ngoName = ngo.name;

  // streamId is a client-supplied query param, not something to trust and
  // echo back directly (issue #215) -- confirm it actually names one of
  // this NGO's streams before the confirmation text claims it's active, so
  // a crafted link can't fabricate a confirmation for a stream that was
  // never created.
  const streams = await getStreams({ ngo: id }).catch(() => []);
  const confirmedStreamId =
    streamId && streams.some((stream) => stream.onChainId === streamId) ? streamId : null;

  return (
    <main id="main" className="px-6 py-16 sm:px-12">
        <div className="max-w-md rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
          <p className="font-medium text-green-800 dark:text-green-300">Stream started!</p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            {confirmedStreamId
              ? `Stream #${confirmedStreamId} is now active, streaming to ${ngoName}.`
              : `Your stream to ${ngoName} is now active.`}
          </p>
        </div>

        <div className="mt-8 max-w-md">
          <h2 className="font-semibold">Know someone else who&apos;d want to help?</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Share {ngoName}&apos;s profile so others can start their own stream.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/ngos/${id}`}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              View {ngoName}&apos;s profile
            </Link>
            <CopyLinkButton path={`/ngos/${id}`} />
          </div>
        </div>

        <p className="mt-8 text-sm">
          <Link href="/dashboard" className="underline">
            See all your streams
          </Link>
        </p>
      </main>
  );
}
