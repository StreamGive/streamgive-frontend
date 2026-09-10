'use client';

import { useState } from 'react';

const CONFIRMATION_RESET_MS = 2000;

/** A small button that copies a full address to the clipboard, showing a
 * brief label change as confirmation instead of a toast. */
export function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), CONFIRMATION_RESET_MS);
    } catch {
      // Clipboard access can be denied by the browser; nothing useful to do
      // beyond leaving the label unchanged so the user can copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={address}
      aria-label={`Copy address ${address}`}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
