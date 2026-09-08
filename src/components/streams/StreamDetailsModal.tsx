'use client';

import Link from 'next/link';

import type { Stream } from '@/lib/api';
import { formatAmount } from '@/lib/format';
import { getNativeAssetAddress } from '@/lib/stellar';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// There's no symbol/name resolution for arbitrary tokens — only the native
// asset's contract address is derivable client-side.
function tokenLabel(tokenAddress: string): string {
  return tokenAddress === getNativeAssetAddress() ? 'XLM' : tokenAddress;
}

export function StreamDetailsModal({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stream-details-heading"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="stream-details-heading" className="text-lg font-semibold">
            Stream details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium">{stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">NGO</dt>
            <dd className="font-medium">
              <Link href={`/ngos/${stream.ngo.id}`} className="underline" onClick={onClose}>
                {stream.ngo.name}
              </Link>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-gray-500">Donor</dt>
            <dd className="break-all text-right font-mono text-xs">{stream.donor.address}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-gray-500">Token</dt>
            <dd className="break-all text-right font-mono text-xs">
              {tokenLabel(stream.tokenAddress)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Rate</dt>
            <dd className="font-medium">{formatAmount(stream.rate)} / second</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Balance</dt>
            <dd className="font-medium">{formatAmount(stream.balance)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Withdrawn</dt>
            <dd className="font-medium">{formatAmount(stream.withdrawn)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Created</dt>
            <dd className="font-medium">{formatDate(stream.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">Last updated</dt>
            <dd className="font-medium">{formatDate(stream.updatedAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">On-chain ID</dt>
            <dd className="font-medium">{stream.onChainId}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
