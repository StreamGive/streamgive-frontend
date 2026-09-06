'use client';

import { useCallback, useEffect, useState } from 'react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgo, getNgos } from '@/lib/api';
import { formatAmount } from '@/lib/format';

const POLL_INTERVAL_MS = 20_000;

type PlatformImpact = {
  totalCommitted: bigint;
  totalWithdrawn: bigint;
  activeStreams: number;
  ngoCount: number;
};

/**
 * There's no platform-wide aggregate endpoint on the backend — only
 * per-NGO stats (/ngos/:id, /impact/:ngoId). This fetches every verified
 * NGO's profile and sums client-side instead. Fine at the NGO counts a
 * new platform would actually have; the first thing to replace with a
 * real backend aggregate if that list ever gets large (N+1 fetches).
 *
 * Donor counts are deliberately not summed here: a donor who gives to two
 * NGOs would be counted twice, and per-NGO stats have no way to dedupe
 * that from the frontend.
 */
async function loadPlatformImpact(): Promise<PlatformImpact> {
  const ngos = await getNgos();
  const profiles = await Promise.all(ngos.map((ngo) => getNgo(ngo.id)));

  let totalCommitted = 0n;
  let totalWithdrawn = 0n;
  let activeStreams = 0;

  for (const profile of profiles) {
    if (!profile) continue;
    totalCommitted += BigInt(profile.stats.totalCommitted);
    totalWithdrawn += BigInt(profile.stats.totalWithdrawn);
    activeStreams += profile.stats.activeStreamCount;
  }

  return { totalCommitted, totalWithdrawn, activeStreams, ngoCount: ngos.length };
}

export default function ImpactPage() {
  const [impact, setImpact] = useState<PlatformImpact | null>(null);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(() => {
    loadPlatformImpact()
      .then(setImpact)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    refresh();
    // Simulates "live" via polling — there's no websocket/SSE push from
    // the backend to actually stream updates.
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Platform impact</h1>
        <p className="mt-2 text-sm text-gray-500">
          Updates automatically every {POLL_INTERVAL_MS / 1000} seconds.
        </p>

        {loadError && (
          <p className="mt-8 text-red-600">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {!loadError && !impact && (
          <p role="status" className="mt-8 text-gray-500">
            Loading…
          </p>
        )}

        {!loadError && impact && (
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-gray-500">Total committed</dt>
              <dd className="text-2xl font-bold">
                {formatAmount(impact.totalCommitted.toString())}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Withdrawn by NGOs</dt>
              <dd className="text-2xl font-bold">
                {formatAmount(impact.totalWithdrawn.toString())}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Active streams</dt>
              <dd className="text-2xl font-bold">{impact.activeStreams}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Verified NGOs</dt>
              <dd className="text-2xl font-bold">{impact.ngoCount}</dd>
            </div>
          </dl>
        )}
      </main>
      <Footer />
    </>
  );
}
