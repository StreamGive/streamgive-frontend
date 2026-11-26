'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useId, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { EndingSoonBadge } from '@/components/dashboard/EndingSoonBadge';
import { StreamControls } from '@/components/dashboard/StreamControls';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { type Stream } from '@/lib/api';
import { buildDonationHistoryCsv } from '@/lib/csv';
import { formatTokenAmount, formatTokenTotals, tokenSymbol } from '@/lib/format';
import { isEndingSoon } from '@/lib/streamEnd';
import {
  filterStreams,
  initialStreamFilter,
  sortStreams,
  type SortOrder,
  type StreamFilter,
} from '@/lib/streamFilters';
import { useDonorStreams } from '@/lib/useDonorStreams';
import { useSharedClock } from '@/lib/useSharedClock';

// Client-side pagination over the already-fetched list — same interim
// approach as NgoExplorer, until the backend exposes real limit/offset
// pagination for /streams.
const PAGE_SIZE = 10;

function LiveBalance({ stream }: { stream: Stream }) {
  const t = useTranslations('Dashboard');
  // All rows share one clock instead of each starting its own timer.
  const now = useSharedClock();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();

  if (stream.status !== 'ACTIVE') {
    return <>{formatTokenAmount(stream.balance, stream.tokenAddress)}</>;
  }

  const startsAt = stream.startsAt ? new Date(stream.startsAt).getTime() : 0;
  if (startsAt > 0 && now > 0 && now < startsAt) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>{formatTokenAmount(stream.balance, stream.tokenAddress)}</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-300">
          {t('scheduled')}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {t('startsOn', { date: new Date(startsAt).toLocaleString() })}
        </span>
      </span>
    );
  }

  let estimatedBalance = BigInt(stream.balance);
  if (now > 0) {
    // The live balance only begins accruing once the stream has started.
    const updatedAt = Math.max(new Date(stream.updatedAt).getTime(), startsAt);
    const secondsSince = BigInt(Math.max(0, Math.floor((now - updatedAt) / 1000)));
    estimatedBalance = estimatedBalance - BigInt(stream.rate) * secondsSince;
    if (estimatedBalance < 0n) {
      estimatedBalance = 0n;
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>
        {formatTokenAmount(estimatedBalance.toString(), stream.tokenAddress)} {t('estimated')}
      </span>
      <button
        type="button"
        aria-label={t('estimatedBalanceHelp')}
        aria-expanded={helpOpen}
        aria-controls={helpId}
        onClick={() => setHelpOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setHelpOpen(false);
          }
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-400 text-xs leading-none"
      >
        i
      </button>
      {helpOpen && (
        <span
          id={helpId}
          role="note"
          className="block w-full text-xs text-gray-600 dark:text-gray-400"
        >
          {t('estimatedBalanceHelp')}
        </span>
      )}
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

export type { SortOrder };

export default function DashboardPage() {
  // The token filter reads useSearchParams(), which requires a Suspense
  // boundary — otherwise it forces the whole route into client-side
  // rendering.
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const t = useTranslations('Dashboard');
  const { address } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detailsStream, setDetailsStream] = useState<Stream | null>(null);
  const [filter, setFilter] = useState<StreamFilter>('ALL');
  const [tokenFilter, setTokenFilter] = useState(() => searchParams.get('token') ?? '');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [isEndedOpen, setIsEndedOpen] = useState(false);

  const { streams, loading, loadError, refresh } = useDonorStreams(address, (data) =>
    setFilter(initialStreamFilter(data)),
  );

  const searchParamsString = searchParams.toString();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the token filter in sync with back/forward navigation, same as the explorer
    setTokenFilter(searchParams.get('token') ?? '');
  }, [searchParamsString, searchParams]);

  const totalCommitted = formatTokenTotals(
    streams.map((s) => ({
      tokenAddress: s.tokenAddress,
      raw: BigInt(s.balance) + BigInt(s.withdrawn),
    })),
  );
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;
  const ngosSupported = new Set(streams.map((s) => s.ngo.id)).size;
  const remainingTime = (stream: Stream) => {
    const balance = BigInt(stream.balance);
    if (balance <= 0n) return t('fullyDrained');
    const rate = BigInt(stream.rate);
    if (rate <= 0n) return '';
    const seconds = Number(balance / rate);
    if (seconds < 60) return t('secondsRemaining', { count: seconds });
    if (seconds < 3600) return t('minutesRemaining', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('hoursRemaining', { count: Math.floor(seconds / 3600) });
    return t('daysRemaining', { count: Math.floor(seconds / 86400) });
  };
  const trimmedSearchQuery = searchQuery.trim();
  // Built from the tokens actually present in the donor's streams, in the
  // order they first appear, so the filter never offers an empty option.
  const tokenOptions: string[] = [];
  const seenTokens = new Set<string>();
  for (const stream of streams) {
    if (seenTokens.has(stream.tokenAddress)) continue;
    seenTokens.add(stream.tokenAddress);
    tokenOptions.push(stream.tokenAddress);
  }
  const filteredStreams = filterStreams(streams, filter, trimmedSearchQuery, tokenFilter);
  const sortedStreams = sortStreams(filteredStreams, sortOrder);

  const visibleStreams = sortedStreams.slice(0, visibleCount);
  const hasMore = visibleCount < sortedStreams.length;

  const isEndedStream = (s: Stream) => s.status === 'CANCELLED' || BigInt(s.balance) <= 0n;

  const endedStreamsCount = sortedStreams.filter(isEndedStream).length;
  const visibleActiveStreams = visibleStreams.filter((s) => !isEndedStream(s));
  const visibleEndedStreams = visibleStreams.filter(isEndedStream);

  // A new filter, search, or sort order starts back at the first page
  function handleFilterChange(next: StreamFilter): void {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
    if (next === 'CANCELLED') {
      setIsEndedOpen(true);
    }
  }

  // The token filter is synced to the URL so shared links and back/forward
  // keep the donor on the same token. router.replace (not push) so changing
  // it doesn't fill history with one entry per selection.
  function handleTokenChange(value: string): void {
    setTokenFilter(value);
    setVisibleCount(PAGE_SIZE);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('token', value);
    } else {
      params.delete('token');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
        <h1 className="text-2xl font-bold">{t('heading')}</h1>

        {!address && <ConnectWalletPrompt className="mt-8" message={t('connectPrompt')} />}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            {t('loading')}
          </p>
        )}

        {address && !loading && loadError && streams.length === 0 && (
          <div className="mt-8">
            <p className="text-red-600 dark:text-red-400">{t('loadError')}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {address && !loading && !loadError && streams.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">
            {t('emptyBeforeLink')}{' '}
            <Link href="/ngos" className="underline">
              {t('exploreNgos')}
            </Link>
            {t('emptyAfterLink')}
          </p>
        )}

        {address && !loading && streams.length > 0 && (
          <>
            {/* A later poll failed, but we still have the last good list —
                keep showing it rather than replacing it with an error. */}
            {loadError && (
              <p role="status" className="mb-4 text-sm text-amber-700 dark:text-amber-400">
                {t('refreshError')}
              </p>
            )}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <dl className="grid grid-cols-2 gap-6 sm:w-fit sm:grid-cols-4 min-w-0">
                <div className="min-w-0">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t('totalStreams', { count: streams.length })}
                  </dt>
                  <dd className="text-lg font-semibold">{streams.length}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t('totalCommitted')}
                  </dt>
                  <dd className="break-words text-lg font-semibold">{totalCommitted}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t('activeStreams', { count: activeCount })}
                  </dt>
                  <dd className="text-lg font-semibold">{activeCount}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t('ngosSupported', { count: ngosSupported })}
                  </dt>
                  <dd className="text-lg font-semibold">{ngosSupported}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => downloadDonationHistoryCsv(filteredStreams)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                {t('exportCsv')}
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-center gap-4">
                <div role="tablist" aria-label={t('filterStreams')} className="flex gap-4">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'ALL'}
                    onClick={() => handleFilterChange('ALL')}
                    className={`pb-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${filter === 'ALL' ? 'border-b-2 border-black text-black dark:border-white dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                  >
                    {t('all')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'ACTIVE'}
                    onClick={() => handleFilterChange('ACTIVE')}
                    className={`pb-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${filter === 'ACTIVE' ? 'border-b-2 border-black text-black dark:border-white dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                  >
                    {t('active')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'CANCELLED'}
                    onClick={() => handleFilterChange('CANCELLED')}
                    className={`pb-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${filter === 'CANCELLED' ? 'border-b-2 border-black text-black dark:border-white dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                  >
                    {t('cancelled')}
                  </button>
                </div>

                <div className="flex items-center gap-2 pb-2">
                  <label
                    htmlFor="token-filter"
                    className="text-sm font-medium text-gray-500 dark:text-gray-400"
                  >
                    {t('tokenLabel')}
                  </label>
                  <select
                    id="token-filter"
                    aria-label={t('tokenFilterLabel')}
                    value={tokenFilter}
                    onChange={(event) => handleTokenChange(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <option value="">{t('allTokens')}</option>
                    {tokenOptions.map((token) => (
                      <option key={token} value={token}>
                        {tokenSymbol(token)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <label
                  htmlFor="sort-order"
                  className="text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  {t('sortLabel')}
                </label>
                <select
                  id="sort-order"
                  aria-label={t('sortBy')}
                  value={sortOrder}
                  onChange={(event) => handleSortChange(event.target.value as SortOrder)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="newest">{t('newest')}</option>
                  <option value="oldest">{t('oldest')}</option>
                  <option value="largest-committed">{t('largestCommitted')}</option>
                  <option value="ending-soonest">{t('endingSoonest')}</option>
                </select>
              </div>
            </div>

            <label className="mt-4 block max-w-xs">
              <span className="sr-only">{t('searchLabel')}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            {filteredStreams.length === 0 ? (
              <p className="mt-8 text-gray-600 dark:text-gray-400">
                {trimmedSearchQuery
                  ? t('noSearchResults', { query: trimmedSearchQuery })
                  : t(
                      filter === 'ACTIVE'
                        ? 'noActiveStreams'
                        : filter === 'CANCELLED'
                          ? 'noCancelledStreams'
                          : 'noStreams',
                    )}
              </p>
            ) : (
              <div className="mt-6 space-y-8">
                {visibleActiveStreams.length > 0 && (
                  <ul className="space-y-4" data-testid="active-streams-list">
                    {visibleActiveStreams.map((stream) => (
                      <StreamCard
                        key={stream.id}
                        stream={stream}
                        t={t}
                        remainingTime={remainingTime}
                        onViewDetails={setDetailsStream}
                        onChanged={refresh}
                      />
                    ))}
                  </ul>
                )}

                {visibleActiveStreams.length === 0 &&
                  visibleEndedStreams.length > 0 &&
                  filter === 'ACTIVE' && (
                    <p className="text-gray-600 dark:text-gray-400">{t('noActiveStreams')}</p>
                  )}

                {visibleEndedStreams.length > 0 && (
                  <details
                    open={isEndedOpen}
                    onToggle={(e) => setIsEndedOpen(e.currentTarget.open)}
                    className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                    data-testid="ended-streams-section"
                  >
                    <summary className="cursor-pointer font-medium text-gray-700 select-none dark:text-gray-300">
                      {t('endedStreamsSection', { count: endedStreamsCount })}
                    </summary>
                    <ul className="mt-4 space-y-4" data-testid="ended-streams-list">
                      {visibleEndedStreams.map((stream) => (
                        <StreamCard
                          key={stream.id}
                          stream={stream}
                          t={t}
                          remainingTime={remainingTime}
                          onViewDetails={setDetailsStream}
                          onChanged={refresh}
                        />
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  {t('loadMore')}
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

function StreamCard({
  stream,
  t,
  remainingTime,
  onViewDetails,
  onChanged,
}: {
  stream: Stream;
  t: ReturnType<typeof useTranslations<'Dashboard'>>;
  remainingTime: (stream: Stream) => string;
  onViewDetails: (stream: Stream) => void;
  onChanged: () => void;
}) {
  return (
    <li
      key={stream.id}
      className="stream-card rounded-lg border border-gray-200 p-6 dark:border-gray-800"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/ngos/${stream.ngo.id}`} className="font-semibold hover:underline">
            {stream.ngo.name}
          </Link>
          {isEndingSoon(stream) && <EndingSoonBadge />}
          {stream.memo?.trim() && (
            <p
              title={stream.memo}
              className="mt-1 line-clamp-2 max-w-md break-words text-sm text-gray-700 dark:text-gray-300"
            >
              {stream.memo}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {stream.status === 'PAUSED' ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                {t('paused')}
              </span>
            ) : (
              t(stream.status === 'ACTIVE' ? 'active' : 'cancelled')
            )}{' '}
            · {t('balance')}{' '}
            <LiveBalance stream={stream} />
          </p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {t('withdrawn')}{' '}
            {formatTokenAmount(stream.withdrawn, stream.tokenAddress)}
            {stream.status === 'ACTIVE' && remainingTime(stream)
              ? ` · ${remainingTime(stream)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onViewDetails(stream)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {t('viewDetails')}
          </button>
          {(stream.status === 'ACTIVE' || stream.status === 'PAUSED') && (
            <StreamControls stream={stream} onChanged={onChanged} />
          )}
        </div>
      </div>
    </li>
  );
}
