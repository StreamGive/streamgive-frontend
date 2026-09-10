import type { Metadata } from 'next';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { NgoExplorer } from '@/components/ngos/NgoExplorer';
import { getNgo, getNgos, type NgoProfile } from '@/lib/api';

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

        {!loadError && <NgoExplorer ngos={ngos} />}
      </main>
      <Footer />
    </>
  );
}
