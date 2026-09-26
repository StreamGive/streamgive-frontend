'use client';

import { useCallback, useEffect, useState } from 'react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { formatAmount } from '@/lib/format';
import { loadPlatformImpact, type PlatformImpact } from '@/lib/impact';

const POLL_INTERVAL_MS = 20_000;

export default function ImpactPage() {
  const [impact, setImpact] = useState<PlatformImpact | null>(null);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(() => {
    loadPlatformImpact()
      .then((next) => {
        setImpact(next);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof window.setInterval> | undefined;

    const startPolling = () => {
      if (interval) clearInterval(interval);
      refresh();
      interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (interval) {
          clearInterval(interval);
          interval = undefined;
        }
        return;
      }

      startPolling();
    };

    // Simulates "live" via polling — there's no websocket/SSE push from
    // the backend to actually stream updates.
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  return (
    <>
      <Header />
      <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Platform impact</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Updates automatically every {POLL_INTERVAL_MS / 1000} seconds.
        </p>

        {loadError && !impact && (
          <p className="mt-8 text-red-600">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {/* Keep the last good numbers on screen when a later poll fails;
            the next successful poll clears the notice. */}
        {loadError && impact && (
          <p role="status" className="mt-8 text-sm text-amber-600">
            Couldn&apos;t refresh — showing the last numbers we loaded.
          </p>
        )}

        {!loadError && !impact && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {impact && (
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
              <dd className="text-2xl font-bold">
                {formatAmount(impact.totalCommitted.toString())}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Withdrawn by NGOs</dt>
              <dd className="text-2xl font-bold">
                {formatAmount(impact.totalWithdrawn.toString())}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
              <dd className="text-2xl font-bold">{impact.activeStreams}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Verified NGOs</dt>
              <dd className="text-2xl font-bold">{impact.ngoCount}</dd>
            </div>
          </dl>
        )}
      </main>
      <Footer />
    </>
  );
}
