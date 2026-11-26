'use client';

import { useMemo, useState } from 'react';

import { CopyAddressButton } from '@/components/common/CopyAddressButton';
import { WithdrawButton } from '@/components/ngoAdmin/WithdrawButton';
import type { Stream } from '@/lib/api';
import { formatTokenAmount, truncateAddress } from '@/lib/format';

type StatusFilter = 'all' | 'active' | 'cancelled';
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const SORT_LABELS: Record<SortOption, string> = {
  'date-desc': 'Newest first',
  'date-asc': 'Oldest first',
  'amount-desc': 'Largest balance first',
  'amount-asc': 'Smallest balance first',
};

/**
 * Filters and sorts client-side — the NGO admin page already fetches every
 * stream for this NGO in one call (`getStreams({ ngo: match.id })`), so
 * there's no paginated backend query to push filter/sort params into, and
 * doing it here keeps the interaction instant (no round trip per change).
 */
function applyFilterAndSort(streams: Stream[], status: StatusFilter, sort: SortOption): Stream[] {
  const filtered =
    status === 'all' ? streams : streams.filter((s) => s.status === status.toUpperCase());

  // `balance` is a raw i128 string — compared as BigInt, not lexically or
  // via Number(), for the same precision reason formatAmount splits on the
  // BigInt directly rather than going through Number() (see lib/format.ts).
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'date-desc':
        return b.createdAt.localeCompare(a.createdAt);
      case 'date-asc':
        return a.createdAt.localeCompare(b.createdAt);
      case 'amount-desc': {
        const diff = BigInt(b.balance) - BigInt(a.balance);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      }
      case 'amount-asc': {
        const diff = BigInt(a.balance) - BigInt(b.balance);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      }
    }
  });

  return sorted;
}

export function NgoAdminStreamList({
  streams,
  onWithdrawn,
  onViewDetails,
}: {
  streams: Stream[];
  onWithdrawn: () => void;
  onViewDetails: (stream: Stream) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('date-desc');

  const visibleStreams = useMemo(
    () => applyFilterAndSort(streams, statusFilter, sort),
    [streams, statusFilter, sort],
  );

  if (streams.length === 0) {
    return (
      <p className="mt-8 text-gray-600 dark:text-gray-400">
        No one has started a stream to you yet.
      </p>
    );
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-medium">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-medium">Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleStreams.length === 0 ? (
        <p className="mt-4 text-gray-600 dark:text-gray-400">No streams match this filter.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {visibleStreams.map((stream) => (
            <li
              key={stream.id}
              className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm break-all">{truncateAddress(stream.donor.address)}</p>
                    <CopyAddressButton address={stream.donor.address} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {stream.status === 'ACTIVE' ? 'Active' : stream.status === 'PAUSED' ? 'Paused' : 'Cancelled'}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    Balance {formatTokenAmount(stream.balance, stream.tokenAddress)}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    Withdrawn {formatTokenAmount(stream.withdrawn, stream.tokenAddress)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onViewDetails(stream)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    View details
                  </button>
                  {stream.status === 'ACTIVE' && (
                    <WithdrawButton streamOnChainId={stream.onChainId} onWithdrawn={onWithdrawn} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
