import { notFound } from 'next/navigation';

import { CreateStreamForm } from '@/components/donate/CreateStreamForm';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgo } from '@/lib/api';

export default async function DonatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ngoName: string;
  try {
    const ngo = await getNgo(id);
    if (!ngo) {
      notFound();
    }
    ngoName = ngo.name;
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
          <CreateStreamForm ngoId={id} />
        </div>
      </main>
      <Footer />
    </>
  );
}
