import { notFound } from 'next/navigation';

import { CreateStreamForm } from '@/components/donate/CreateStreamForm';
import { getNgo } from '@/lib/api';

// Deliberately no <Header>/<Footer> — this route is meant to be loaded in
// an <iframe> on a third-party (NGO's own) site, not visited directly.
export default async function EmbedDonatePage({
  params,
}: {
  params: Promise<{ ngoId: string }>;
}) {
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
