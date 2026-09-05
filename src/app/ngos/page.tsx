import Link from 'next/link';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgos, type Ngo } from '@/lib/api';

export default async function NgosPage() {
  let ngos: Ngo[] = [];
  let loadError = false;

  try {
    ngos = await getNgos();
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
                <h2 className="font-semibold">{ngo.name}</h2>
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
