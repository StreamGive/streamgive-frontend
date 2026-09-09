'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { NgoProfile } from '@/lib/api';
import { formatAmount } from '@/lib/format';

// Client-side pagination over the already-fetched list — a first step
// until the backend exposes real pagination (see backend repo).
const PAGE_SIZE = 9;

export function NgoExplorer({ ngos }: { ngos: NgoProfile[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (ngos.length === 0) {
    return <p className="mt-4 text-gray-600">No verified NGOs yet.</p>;
  }

  const filteredNgos = ngos.filter((ngo) =>
    ngo.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const visibleNgos = filteredNgos.slice(0, visibleCount);
  const hasMore = visibleCount < filteredNgos.length;

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <>
      <label className="mt-8 block max-w-sm">
        <span className="sr-only">Search NGOs by name</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Search NGOs by name…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleNgos.map((ngo) => (
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

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}
