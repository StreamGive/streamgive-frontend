'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { StreamControls } from '@/components/dashboard/StreamControls';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getStreams, type Stream } from '@/lib/api';
import { buildDonationHistoryCsv } from '@/lib/csv';
import { formatRemainingDuration, formatTokenAmount, formatTokenTotals } from '@/lib/format';
import { useLatestRequest } from '@/lib/useLatestRequest';

// Client-side pagination over the already-fetched list — same interim
// approach as NgoExplorer, until the backend exposes real limit/offset
// pagination for /streams.
const PAGE_SIZE = 10;

// Keeps balances/withdrawn amounts from going stale while the tab sits
// open — same polling approach as the impact page (src/app/impact/page.tsx).
const POLL_INTERVAL_MS = 30_000;

function LiveBalance({ stream }: { stream: Stream }) {
  const [estimatedBalance, setEstimatedBalance] = useState<bigint>(BigInt(stream.balance));

  useEffect(() => {
    if (stream.status !== 'ACTIVE') {
      return;
    }

    const balance = BigInt(stream.balance);
    const rate = BigInt(stream.rate);
    const updatedAt = new Date(stream.updatedAt).getTime();

    const tick = () => {
      const now = Date.now();
      const secondsSince = BigInt(Math.floor((now - updatedAt) / 1000));
      let current = balance - rate * secondsSince;
      if (current < 0n) {
        current = 0n;
      }
      setEstimatedBalance(current);
    };

    // Prime the clock subscription immediately instead of showing an old
    // balance until the first interval fires after a stream update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [stream.balance, stream.rate, stream.updatedAt, stream.status]);

  if (stream.status !== 'ACTIVE') {
    return <>{formatTokenAmount(stream.balance, stream.tokenAddress)}</>;
  }

  return (
    <span title="Estimated current balance based on stream rate" className="border-b border-dotted border-gray-400 cursor-help">
      {formatTokenAmount(estimatedBalance.toString(), stream.tokenAddress)} (est)
    </span>
  );
}

function downloadDonationHistoryCsv(streams: Stream[]): void {
  const blob = new Blob([buildDonationHistoryCsv(streams)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'streamgive-donations.csv';
  // Some browsers cancel the download if the object URL disappears too
  // soon after the click, so the anchor has to actually be in the
  // document when it's clicked, and the URL needs to outlive the click
  // itself rather than being revoked synchronously right after it.
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type SortOrder = 'newest' | 'oldest' | 'largest-committed' | 'ending-soonest';

export default function DashboardPage() {
  const { address } = useWallet();
  const [streams, setStreams] = useState<Stream[]>([]);
  // Starts true so a connected donor never sees the empty state in the
  // render before the first fetch begins.
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailsStream, setDetailsStream] = useState<Stream | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
  const [filterInitialized, setFilterInitialized] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Drop any streams fetched under a previous address as soon as `address`
  // changes, during render rather than in an effect, so a stale list from
  // the old wallet is never painted (even briefly) under the new one.
  const [prevAddress, setPrevAddress] = useState(address);
  if (address !== prevAddress) {
    setPrevAddress(address);
    setStreams([]);
    setLoadError(false);
    setLoading(true);
  }

  // Shared by refresh() and the poll below, so a poll can't overlap a manual
  // refresh (or a wallet switch) and land after it with older data.
  const { begin, cancel } = useLatestRequest();

  const refresh = useCallback(() => {
    if (!address) {
      cancel();
      setStreams([]);
      setFilterInitialized(false);
      return;
    }

    const request = begin();
    setLoading(true);
    setLoadError(false);
    getStreams({ donor: address }, request.signal)
      .then((data) => {
        if (!request.isCurrent()) return;
        setStreams(data);
        setFilterInitialized((prev) => {
          if (!prev) {
            setFilter(data.some((s) => s.status === 'ACTIVE') ? 'ACTIVE' : 'ALL');
            return true;
          }
          return prev;
        });
      })
      .catch(() => {
        if (request.isCurrent()) setLoadError(true);
      })
      .finally(() => {
        if (request.isCurrent()) setLoading(false);
      });
  }, [address, begin, cancel]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!address) return;

    // A quiet background refresh — unlike refresh() above, it never flips
    // `loading` on (the list would otherwise flash "Loading your streams…"
    // every 30s) and never re-runs the first-load filter auto-selection.
    // It shares refresh()'s request guard: starting a poll supersedes an
    // in-flight refresh and vice versa, and a superseded or post-cleanup
    // response is dropped. Because it can supersede a refresh, a poll that
    // settles also clears `loading`.
    let interval: ReturnType<typeof setInterval> | null = null;

    function poll() {
      const request = begin();
      getStreams({ donor: address as string }, request.signal)
        .then((data) => {
          if (!request.isCurrent()) return;
          setStreams(data);
          setLoadError(false);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!request.isCurrent()) return;
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            setLoadError(true);
          }
          setLoading(false);
        });
    }

    function startPolling() {
      if (interval !== null) return;
      interval = setInterval(poll, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    }

    // Pausing while the tab is hidden means actually stopping the
    // interval (not just skipping a tick on a timer that keeps running),
    // and catching up with one immediate poll on becoming visible again.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        poll();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === 'visible') {
      startPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancel();
    };
  }, [address, begin, cancel]);

  const applyOptimisticUpdate = useCallback((streamId: string, patch: Partial<Stream>) => {
    setStreams((prev) => prev.map((s) => (s.id === streamId ? { ...s, ...patch } : s)));
  }, []);

  const totalCommitted = formatTokenTotals(
    streams.map((s) => ({
      tokenAddress: s.tokenAddress,
      raw: BigInt(s.balance) + BigInt(s.withdrawn),
    })),
  );
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;
  const trimmedSearchQuery = searchQuery.trim();
  const filteredStreams = streams.filter((s) => {
    if (filter === 'ACTIVE' && s.status !== 'ACTIVE') return false;
    if (filter === 'CANCELLED' && s.status !== 'CANCELLED') return false;
    // Emptying the search box naturally clears the filter — an empty
    // trimmedSearchQuery is falsy, so this check never excludes anything.
    if (trimmedSearchQuery && !s.onChainId.includes(trimmedSearchQuery)) return false;
    return true;
  });

  const sortedStreams = [...filteredStreams].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortOrder === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortOrder === 'largest-committed') {
      const commA = BigInt(a.balance) + BigInt(a.withdrawn);
      const commB = BigInt(b.balance) + BigInt(b.withdrawn);
      if (commB > commA) return 1;
      if (commB < commA) return -1;
      return 0;
    }
    if (sortOrder === 'ending-soonest') {
      const getRemaining = (s: Stream) => {
        if (s.status !== 'ACTIVE' || BigInt(s.rate) <= 0n) return 999999999999999n;
        const b = BigInt(s.balance);
        if (b <= 0n) return 0n;
        return b / BigInt(s.rate);
      };
      const remA = getRemaining(a);
      const remB = getRemaining(b);
      if (remA > remB) return 1;
      if (remA < remB) return -1;
      return 0;
    }
    return 0;
  });

  const visibleStreams = sortedStreams.slice(0, visibleCount);
  const hasMore = visibleCount < sortedStreams.length;

  // A new filter, search, or sort order starts back at the first page
  function handleFilterChange(next: 'ALL' | 'ACTIVE' | 'CANCELLED'): void {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function handleSortChange(next: SortOrder): void {
    setSortOrder(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <>
      <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Your donations</h1>

        {!address && (
          <ConnectWalletPrompt className="mt-8" message="Connect your wallet to see your streams." />
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading your streams…
          </p>
        )}

        {address && !loading && loadError && streams.length === 0 && (
          <div className="mt-8">
            <p className="text-red-600 dark:text-red-400">
              Couldn&apos;t load your streams. Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {address && !loading && !loadError && streams.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">
            You haven&apos;t started any streams yet.{' '}
            <Link href="/ngos" className="underline">
              Explore NGOs
            </Link>
            .
          </p>
        )}

        {address && !loading && streams.length > 0 && (
          <>
            {/* A later poll failed, but we still have the last good list —
                keep showing it rather than replacing it with an error. */}
            {loadError && (
              <p role="status" className="mb-4 text-sm text-amber-700 dark:text-amber-400">
                Couldn&apos;t refresh — showing the last numbers we loaded.
              </p>
            )}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <dl className="grid grid-cols-3 gap-6 sm:w-fit sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Total streams</dt>
                  <dd className="text-lg font-semibold">{streams.length}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
                  <dd className="text-lg font-semibold">
                    {totalCommitted}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
                  <dd className="text-lg font-semibold">{activeCount}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => downloadDonationHistoryCsv(filteredStreams)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Export CSV
              </button>

            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800">
              <div role="tablist" aria-label="Filter streams" className="flex gap-4">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'ALL'}
                  onClick={() => handleFilterChange('ALL')}
                  className={`pb-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${filter === 'ALL' ? 'border-b-2 border-black text-black dark:border-white dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'ACTIVE'}
                  onClick={() => handleFilterChange('ACTIVE')}
                  className={`pb-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${filter === 'ACTIVE' ? 'border-b-2 border-black text-black dark:border-white dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'CANCELLED'}
                  onClick={() => handleFilterChange('CANCELLED')}
                  className={`pb-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${filter === 'CANCELLED' ? 'border-b-2 border-black text-black dark:border-white dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  Cancelled
                </button>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <label htmlFor="sort-order" className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Sort:
                </label>
                <select
                  id="sort-order"
                  aria-label="Sort by"
                  value={sortOrder}
                  onChange={(event) => handleSortChange(event.target.value as SortOrder)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="largest-committed">Largest committed</option>
                  <option value="ending-soonest">Ending soonest</option>
                </select>
              </div>
            </div>

            <label className="mt-4 block max-w-xs">
              <span className="sr-only">Search by on-chain stream ID</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search by stream ID…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            {filteredStreams.length === 0 ? (
              <p className="mt-8 text-gray-600 dark:text-gray-400">
                {trimmedSearchQuery
                  ? `No streams match stream ID "${trimmedSearchQuery}".`
                  : `No ${filter.toLowerCase()} streams found.`}
              </p>
            ) : (
              <ul className="mt-6 space-y-4">
                {visibleStreams.map((stream) => (
                  <li
                    key={stream.id}
                    className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
                  >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link
                        href={`/ngos/${stream.ngo.id}`}
                        className="font-semibold hover:underline"
                      >
                        {stream.ngo.name}
                      </Link>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'} · Balance{' '}
                        <LiveBalance stream={stream} /> · Withdrawn {formatTokenAmount(stream.withdrawn, stream.tokenAddress)}
                        {stream.status === 'ACTIVE' && formatRemainingDuration(stream.balance, stream.rate)
                          ? ` · ${formatRemainingDuration(stream.balance, stream.rate)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailsStream(stream)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        View details
                      </button>
                      {stream.status === 'ACTIVE' && (
                        <StreamControls stream={stream} onChanged={refresh} />
                      )}
                    </div>
                  </div>
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {detailsStream && (
        <StreamDetailsModal stream={detailsStream} onClose={() => setDetailsStream(null)} />
      )}
    </>
  );
}
