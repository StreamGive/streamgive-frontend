'use client';

import { APP_URL } from '@/lib/config';

export function EmbedSnippet({ ngoId }: { ngoId: string }) {
  const snippet = `<iframe src="${APP_URL}/embed/${ngoId}" width="400" height="600" style="border:0"></iframe>`;

  return (
    <div className="mt-8 rounded-lg border border-gray-200 p-6">
      <h2 className="font-semibold">Embed your donate widget</h2>
      <p className="mt-1 text-sm text-gray-600">
        Paste this on your own website to accept streaming donations directly. Don&apos;t apply a
        restrictive <code className="rounded bg-gray-100 px-1">sandbox</code> attribute — wallet
        connection needs popups and scripts.
      </p>
      <textarea
        readOnly
        rows={2}
        value={snippet}
        onClick={(event) => event.currentTarget.select()}
        className="mt-3 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs"
      />
    </div>
  );
}
