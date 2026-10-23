'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { NgoProfile } from '@/lib/api';
import { formatAmount } from '@/lib/format';

// Client-side pagination over the already-fetched list — a first step
// until the backend exposes real pagination (see backend repo).
const PAGE_SIZE = 9;

type SortOption = 'newest' | 'most-active-streams' | 'most-committed';

function sortNgos(ngos: NgoProfile[], sort: SortOption): NgoProfile[] {
  const copy = [...ngos];
  if (sort === 'most-active-streams') {
    return copy.sort((a, b) => b.stats.activeStreamCount - a.stats.activeStreamCount);
  }
  if (sort === 'most-committed') {
    // totalCommitted is a raw i128 string — compared as BigInt, not via
    // parseFloat, which loses precision above 2^53 and can misorder large
    // totals (same reasoning as NgoAdminStreamList's balance sort).
    return copy.sort((a, b) => {
      const diff = BigInt(b.stats.totalCommitted) - BigInt(a.stats.totalCommitted);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
  }
  // newest: sort by createdAt descending
  return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// "page" in the URL counts how many PAGE_SIZE batches "Load more" has
// revealed (1 = just the first page), not a byte/row offset.
function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

// Only a non-default sort is carried in the URL; 'newest' is the implicit
// default and is omitted to keep shared links tidy.
const SORT_OPTIONS: readonly SortOption[] = ['newest', 'most-active-streams', 'most-committed'];

function parseSort(value: string | null): SortOption {
  return SORT_OPTIONS.includes(value as SortOption) ? (value as SortOption) : 'newest';
}

export function NgoExplorer({ ngos }: { ngos: NgoProfile[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(() => parsePage(searchParams.get('page')));
  const [sortBy, setSortBy] = useState<SortOption>(() => parseSort(searchParams.get('sort')));

  // Sync incoming URL changes before rendering, while keeping immediate
  // local updates from the handlers below until navigation completes.
  const queryString = searchParams.toString();
  const [previousQueryString, setPreviousQueryString] = useState(queryString);
  if (queryString !== previousQueryString) {
    setPreviousQueryString(queryString);
    setSearchQuery(searchParams.get('q') ?? '');
    setPage(parsePage(searchParams.get('page')));
    setSortBy(parseSort(searchParams.get('sort')));
  }

  const visibleCount = page * PAGE_SIZE;

  // q, page and sort are synced to the URL so links/back-forward preserve
  // the full explorer state. router.replace (not push) so search-as-you-type
  // doesn't fill history with one entry per keystroke.
  function syncParams(next: { q?: string; page?: number; sort?: SortOption }): void {
    const params = new URLSearchParams(searchParams.toString());

    if (next.q !== undefined) {
      if (next.q) {
        params.set('q', next.q);
      } else {
        params.delete('q');
      }
    }
    if (next.page !== undefined) {
      if (next.page > 1) {
        params.set('page', String(next.page));
      } else {
        params.delete('page');
      }
    }
    if (next.sort !== undefined) {
      if (next.sort !== 'newest') {
        params.set('sort', next.sort);
      } else {
        params.delete('sort');
      }
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (ngos.length === 0) {
    return <p className="mt-4 text-gray-600 dark:text-gray-400">No verified NGOs yet.</p>;
  }

  const filteredNgos = sortNgos(
    ngos.filter((ngo) => ngo.name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    sortBy,
  );
  const visibleNgos = filteredNgos.slice(0, visibleCount);
  const hasMore = visibleCount < filteredNgos.length;

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    setPage(1);
    syncParams({ q: value, page: 1 });
  }

  function handleSortChange(value: SortOption): void {
    setSortBy(value);
    setPage(1);
    syncParams({ sort: value, page: 1 });
  }

  function handleLoadMore(): void {
    const nextPage = page + 1;
    setPage(nextPage);
    syncParams({ page: nextPage });
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end gap-4">
        <label className="block flex-1 min-w-[200px] max-w-sm">
          <span className="sr-only">Search NGOs by name</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search NGOs by name…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="block">
          <span className="sr-only">Sort NGOs</span>
          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value as SortOption)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="newest">Newest</option>
            <option value="most-active-streams">Most active streams</option>
            <option value="most-committed">Most committed</option>
          </select>
        </label>
      </div>

      {filteredNgos.length === 0 ? (
        <p className="mt-8 text-gray-600 dark:text-gray-400">
          No NGOs match &quot;{searchQuery.trim()}&quot;.
        </p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleNgos.map((ngo) => (
            <li key={ngo.id}>
              <Link
                href={`/ngos/${ngo.id}`}
                className="block rounded-lg border border-gray-200 p-6 hover:bg-gray-50 focus-visible:border-gray-400 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:border-gray-800 dark:hover:bg-gray-900 dark:focus-visible:border-gray-600 dark:focus-visible:bg-gray-900 dark:focus-visible:ring-white"
              >
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{ngo.name}</h2>
                  {ngo.verified && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
                      Verified
                    </span>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Committed</dt>
                    <dd className="text-sm font-semibold">
                      {formatAmount(ngo.stats.totalCommitted)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Streams</dt>
                    <dd className="text-sm font-semibold">{ngo.stats.activeStreamCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Donors</dt>
                    <dd className="text-sm font-semibold">{ngo.stats.donorCount}</dd>
                  </div>
                </dl>

                <span className="mt-4 inline-block text-sm font-medium text-black underline dark:text-white">
                  View profile
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}
