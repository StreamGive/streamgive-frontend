import type { Metadata } from 'next';
import Link from 'next/link';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgo, getNgos, type NgoProfile } from '@/lib/api';
import { formatAmount } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Explore NGOs',
  description: 'Browse verified NGOs accepting recurring, streaming donations on Stellar.',
};

export default async function NgosPage() {
  let ngos: NgoProfile[] = [];
  let loadError = false;

  try {
    const list = await getNgos();
    // No aggregate stats on the list endpoint — fetch each profile for its
    // stats. Same N+1 tradeoff already accepted on the platform impact page.
    const profiles = await Promise.all(list.map((ngo) => getNgo(ngo.id)));
    ngos = profiles.filter((profile): profile is NgoProfile => profile !== null);
  } catch {
    loadError = true;
  }

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Explore NGOs</h1>

        {loadError && (
          <p className="mt-4 text-red-600">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {!loadError && ngos.length === 0 && (
          <p className="mt-4 text-gray-600">No verified NGOs yet.</p>
        )}

        {!loadError && ngos.length > 0 && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ngos.map((ngo) => (
              <li key={ngo.id} className="rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{ngo.name}</h2>
                  {ngo.verified && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Verified
                    </span>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-xs text-gray-500">Committed</dt>
                    <dd className="text-sm font-semibold">
                      {formatAmount(ngo.stats.totalCommitted)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Streams</dt>
                    <dd className="text-sm font-semibold">{ngo.stats.activeStreamCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Donors</dt>
                    <dd className="text-sm font-semibold">{ngo.stats.donorCount}</dd>
                  </div>
                </dl>

                <Link
                  href={`/ngos/${ngo.id}`}
                  className="mt-4 inline-block text-sm font-medium text-black underline"
                >
                  View profile
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
