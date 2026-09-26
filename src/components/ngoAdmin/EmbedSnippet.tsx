'use client';

import { useState, useSyncExternalStore } from 'react';

import { APP_URL } from '@/lib/config';

// The origin never changes while the page is open, so there is nothing to
// subscribe to — this just lets React read a different value on the server
// (where `window` does not exist) than in the browser, without a hydration
// mismatch or a setState-in-effect.
const noopSubscribe = () => () => {};

const SIZE_PRESETS = {
  compact: { label: 'Compact (300×500)', width: 300, height: 500 },
  standard: { label: 'Standard (400×600)', width: 400, height: 600 },
  wide: { label: 'Wide (600×400)', width: 600, height: 400 },
  custom: { label: 'Custom', width: 400, height: 600 },
} as const;

type PresetKey = keyof typeof SIZE_PRESETS;

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

  const [preset, setPreset] = useState<PresetKey>('standard');
  const [customWidth, setCustomWidth] = useState(SIZE_PRESETS.custom.width);
  const [customHeight, setCustomHeight] = useState(SIZE_PRESETS.custom.height);

  const { width, height } =
    preset === 'custom' ? { width: customWidth, height: customHeight } : SIZE_PRESETS[preset];

  const snippet = `<iframe src="${origin}/embed/${ngoId}" width="${width}" height="${height}" style="border:0"></iframe>`;

  return (
    <div className="mt-8 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
      <h2 className="font-semibold">Embed your donate widget</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Paste this on your own website to accept streaming donations directly. Don&apos;t apply a
        restrictive <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">sandbox</code>{' '}
        attribute — wallet connection needs popups and scripts.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Size</span>
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as PresetKey)}
            className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {Object.entries(SIZE_PRESETS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {preset === 'custom' && (
          <>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Width</span>
              <input
                type="number"
                min={100}
                value={customWidth}
                onChange={(event) => setCustomWidth(Number(event.target.value) || 0)}
                className="mt-1 block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Height</span>
              <input
                type="number"
                min={100}
                value={customHeight}
                onChange={(event) => setCustomHeight(Number(event.target.value) || 0)}
                className="mt-1 block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          </>
        )}
      </div>

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
