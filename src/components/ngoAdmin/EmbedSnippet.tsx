'use client';

import { useSyncExternalStore } from 'react';

import { APP_URL } from '@/lib/config';

// The origin never changes while the page is open, so there is nothing to
// subscribe to — this just lets React read a different value on the server
// (where `window` does not exist) than in the browser, without a hydration
// mismatch or a setState-in-effect.
const noopSubscribe = () => () => {};

/**
 * Builds the iframe snippet an NGO pastes into their own site.
 *
 * The origin comes from the browser rather than configuration: it is always
 * right, on production, preview deployments and localhost alike, and there
 * is no environment variable to forget or set wrongly. `APP_URL` is only the
 * server-render fallback, replaced the moment the page hydrates.
 */
export function EmbedSnippet({ ngoId }: { ngoId: string }) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => APP_URL,
  );

  const snippet = `<iframe src="${origin}/embed/${ngoId}" width="400" height="600" style="border:0"></iframe>`;

  return (
    <div className="mt-8 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
      <h2 className="font-semibold">Embed your donate widget</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Paste this on your own website to accept streaming donations directly. Don&apos;t apply a
        restrictive{' '}
        <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">sandbox</code> attribute —
        wallet connection needs popups and scripts.
      </p>
      <textarea
        readOnly
        rows={2}
        value={snippet}
        onClick={(event) => event.currentTarget.select()}
        className="mt-3 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
      />
    </div>
  );
}
