import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CreateStreamForm } from '@/components/donate/CreateStreamForm';
import { getNgo, type NgoProfile } from '@/lib/api';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ngo = await getNgo(id).catch(() => null);
  return { title: ngo ? `Donate to ${ngo.name}` : 'NGO not found' };
}

export default async function DonatePage({ params }: Props) {
  const { id } = await params;

  let ngo: NgoProfile | null;
  try {
    ngo = await getNgo(id);
  } catch {
    return (
      <main id="main" className="px-6 py-16 sm:px-12">
        <p className="text-red-600 dark:text-red-400">
          Couldn&apos;t load this NGO&apos;s details. Please check your connection and try again.
        </p>
        <Link
          href={`/ngos/${id}/donate`}
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
  // The on-chain call needs the NGO's Stellar address, not its internal
  // database id — `id` above is only a route/lookup key into our API.
  const ngoAddress = ngo.ownerAddress;

  if (!ngo.verified) {
    return (
      <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Start streaming to {ngoName}</h1>
        <p className="mt-6 text-gray-600 dark:text-gray-400">
          {ngoName} is not yet verified and cannot receive streams at this time.
        </p>
      </main>
    );
  }

  return (
    <main id="main" className="px-6 py-16 sm:px-12">
      <h1 className="text-2xl font-bold">Start streaming to {ngoName}</h1>
      <div className="mt-8">
        <CreateStreamForm ngoId={id} ngoAddress={ngoAddress} ngoName={ngoName} />
      </div>
    </main>
  );
}
