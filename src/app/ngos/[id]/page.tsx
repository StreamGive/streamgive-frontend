import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgo, type NgoProfile } from '@/lib/api';

export default async function NgoProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ngo: NgoProfile | null;
  try {
    ngo = await getNgo(id);
  } catch {
    return (
      <>
        <Header />
        <main className="px-6 py-16 sm:px-12">
          <p className="text-red-600">
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

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{ngo.name}</h1>
          {ngo.verified && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              Verified
            </span>
          )}
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-gray-500">Total committed</dt>
            <dd className="text-lg font-semibold">{ngo.stats.totalCommitted}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Total withdrawn</dt>
            <dd className="text-lg font-semibold">{ngo.stats.totalWithdrawn}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Active streams</dt>
            <dd className="text-lg font-semibold">{ngo.stats.activeStreamCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Donors</dt>
            <dd className="text-lg font-semibold">{ngo.stats.donorCount}</dd>
          </div>
        </dl>

        <Link
          href={`/ngos/${ngo.id}/donate`}
          className="mt-10 inline-block rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Start streaming
        </Link>
      </main>
      <Footer />
    </>
  );
}
