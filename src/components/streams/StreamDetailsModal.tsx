'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { CopyAddressButton } from '@/components/common/CopyAddressButton';
import type { Stream } from '@/lib/api';
import { formatDateTime, formatTokenAmount, tokenLabel } from '@/lib/format';
import { DONATION_VAULT_CONTRACT_ID, explorerUrl } from '@/lib/stellar';

export function StreamDetailsModal({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const triggerElement = document.activeElement as HTMLElement | null;

    // Move focus to close button after a tiny tick to ensure render is complete, though React effects usually suffice.
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    return () => {
      if (triggerElement && typeof triggerElement.focus === 'function') {
        triggerElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      
      if (event.key === 'Tab') {
        if (!dialogRef.current) return;
        
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
        
        if (focusable.length === 0) return;
        
        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stream-details-heading"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="stream-details-heading" className="text-lg font-semibold">
            Stream details
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            &times;
          </button>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Status</dt>
            <dd className="font-medium">{stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">NGO</dt>
            <dd className="font-medium">
              <Link href={`/ngos/${stream.ngo.id}`} className="underline" onClick={onClose}>
                {stream.ngo.name}
              </Link>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-gray-500 dark:text-gray-400">Donor</dt>
            <dd className="flex items-center justify-end gap-2 break-all text-right font-mono text-xs">
              <a
                href={explorerUrl('account', stream.donor.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {stream.donor.address}
              </a>
              <CopyAddressButton address={stream.donor.address} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-gray-500 dark:text-gray-400">Token</dt>
            <dd className="flex items-center justify-end gap-2 break-all text-right font-mono text-xs">
              <a
                href={explorerUrl('contract', stream.tokenAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {tokenLabel(stream.tokenAddress)}
              </a>
              <CopyAddressButton address={stream.tokenAddress} />
            </dd>
          </div>
          {DONATION_VAULT_CONTRACT_ID && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">Contract</dt>
              <dd className="flex items-center justify-end gap-2 font-medium">
                <a
                  href={explorerUrl('contract', DONATION_VAULT_CONTRACT_ID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View contract
                </a>
                <CopyAddressButton address={DONATION_VAULT_CONTRACT_ID} />
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Rate</dt>
            <dd className="font-medium">{formatTokenAmount(stream.rate, stream.tokenAddress)} / second</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Balance</dt>
            <dd className="font-medium">{formatTokenAmount(stream.balance, stream.tokenAddress)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Withdrawn</dt>
            <dd className="font-medium">{formatTokenAmount(stream.withdrawn, stream.tokenAddress)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Created</dt>
            <dd className="font-medium">{formatDateTime(stream.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">Last updated</dt>
            <dd className="font-medium">{formatDateTime(stream.updatedAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500 dark:text-gray-400">On-chain ID</dt>
            <dd className="flex items-center justify-end gap-2 font-medium">
              {stream.onChainId}
              <CopyAddressButton address={stream.onChainId} />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
