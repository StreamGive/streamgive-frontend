import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CreateStreamForm } from '@/components/donate/CreateStreamForm';
import { getNgo } from '@/lib/api';

type Props = { params: Promise<{ ngoId: string }> };

// noindex: this is a widget meant to live inside someone else's iframe,
// not a page anyone should land on directly from search.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ngoId } = await params;
  const ngo = await getNgo(ngoId).catch(() => null);
  return {
    title: ngo ? `Give to ${ngo.name}` : 'NGO not found',
    robots: { index: false, follow: false },
  };
}

// Deliberately no <Header>/<Footer> — this route is meant to be loaded in
// an <iframe> on a third-party (NGO's own) site, not visited directly.
export default async function EmbedDonatePage({ params }: Props) {
  const { ngoId } = await params;

  let ngoName: string;
  let ngoAddress: string;
  try {
    const ngo = await getNgo(ngoId);
    if (!ngo) {
      notFound();
    }
    ngoName = ngo.name;
    ngoAddress = ngo.ownerAddress;
  } catch {
    return (
      <div className="p-6 text-center text-sm text-red-600">
        Couldn&apos;t reach the StreamGive API.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-lg font-bold">Give to {ngoName}</h1>
      <p className="mt-1 text-xs text-gray-500">Powered by StreamGive</p>
      <div className="mt-6">
        <CreateStreamForm ngoAddress={ngoAddress} />
      </div>
    </div>
  );
}
