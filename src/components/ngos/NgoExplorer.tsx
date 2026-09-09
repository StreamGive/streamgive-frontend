'use client';

import Link from 'next/link';

import type { NgoProfile } from '@/lib/api';
import { formatAmount } from '@/lib/format';

export function NgoExplorer({ ngos }: { ngos: NgoProfile[] }) {
  if (ngos.length === 0) {
    return <p className="mt-4 text-gray-600">No verified NGOs yet.</p>;
  }

  return (
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
              <dd className="text-sm font-semibold">{formatAmount(ngo.stats.totalCommitted)}</dd>
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
  );
}
