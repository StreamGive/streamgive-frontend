import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CreateStreamForm } from '@/components/donate/CreateStreamForm';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgo } from '@/lib/api';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ngo = await getNgo(id).catch(() => null);
  return { title: ngo ? `Donate to ${ngo.name}` : 'NGO not found' };
}

export default async function DonatePage({ params }: Props) {
  const { id } = await params;

  let ngoName: string;
  let ngoAddress: string;
  try {
    const ngo = await getNgo(id);
    if (!ngo) {
      notFound();
    }
    ngoName = ngo.name;
    // The on-chain call needs the NGO's Stellar address, not its internal
    // database id — `id` above is only a route/lookup key into our API.
    ngoAddress = ngo.ownerAddress;
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

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Start streaming to {ngoName}</h1>
        <div className="mt-8">
          <CreateStreamForm ngoAddress={ngoAddress} />
        </div>
      </main>
      <Footer />
    </>
  );
}
