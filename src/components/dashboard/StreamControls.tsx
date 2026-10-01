'use client';

import { useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getStreams, type Stream } from '@/lib/api';
import { useDonationVaultClient } from '@/lib/donationVaultClient';
import { formatEstimatedFee, parseAmount, TOKEN_DECIMALS } from '@/lib/format';

/**
 * Computes the per-second token rate for a stream modification.
 *
 * Divides the remaining balance (raw i128 string) by a duration in seconds
 * using integer division, mirroring the on-chain contract's expectation.
 * Returns `null` when the result would be zero (balance too small for the
 * chosen duration) so the caller can surface a validation error instead of
 * submitting a zero-rate transaction.
 */
export function computeModifyRate(balance: string, durationSeconds: number): bigint | null {
  const rate = BigInt(balance) / BigInt(durationSeconds);
  return rate > 0n ? rate : null;
}

const DURATIONS = [
  { label: '1 week', seconds: 7 * 24 * 60 * 60 },
  { label: '1 month', seconds: 30 * 24 * 60 * 60 },
  { label: '3 months', seconds: 90 * 24 * 60 * 60 },
  { label: '1 year', seconds: 365 * 24 * 60 * 60 },
];

// The list this sits in comes from the backend's indexer, which polls on
// an interval — a confirmed on-chain action can lag a few seconds before
// onChanged()'s refresh actually reflects it. Said explicitly in the
// success toast so it doesn't look like nothing happened.
const INDEXING_LAG_NOTE = 'may take a few seconds to show below';

type Mode = 'idle' | 'toppingUp' | 'modifying' | 'confirmingCancel';

// Which on-chain action is in flight, so the idle buttons can say what's
// actually happening instead of reading "Cancelling…" for everything.
type PendingAction = 'topUp' | 'modifyRate' | 'cancel' | null;

export function StreamControls({
  stream,
  onChanged,
  onOptimisticUpdate,
}: {
  stream: Stream;
  onChanged: () => void;
  /**
   * Applies an immediate local patch to this stream, ahead of onChanged()'s
   * re-fetch — the indexer that backs that re-fetch polls on an interval,
   * so without this the UI would sit on stale numbers for a few seconds
   * after a confirmed on-chain action. Whatever the re-fetch eventually
   * returns still wins once it lands, rolling this guess back if it turns
   * out to have been wrong.
   */
  onOptimisticUpdate?: (patch: Partial<Stream>) => void;
}) {
  const { address } = useWallet();
  const { client, ready } = useDonationVaultClient();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [pending, setPending] = useState<PendingAction>(null);
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[1].seconds);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const topUpAmountRaw = parseAmount(topUpAmount);

  async function handleTopUp(): Promise<void> {
    if (!address || !client || topUpAmountRaw === null) return;

    setMode('idle');
    setPending('topUp');
    try {
      const tx = await client.top_up({
        stream_id: BigInt(stream.onChainId),
        amount: topUpAmountRaw,
      });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      await tx.signAndSend();
      showToast('success', `Stream topped up — ${INDEXING_LAG_NOTE}.`);
      setTopUpAmount('');
      onOptimisticUpdate?.({ balance: (BigInt(stream.balance) + topUpAmountRaw).toString() });
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
      setEstimatedFee(null);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!address || !client) return;
    setMode('idle');
    setPending('cancel');
    try {
      const tx = await client.cancel_stream({ stream_id: BigInt(stream.onChainId) });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      await tx.signAndSend();
      showToast('success', `Stream cancelled — ${INDEXING_LAG_NOTE}.`);
      onOptimisticUpdate?.({ status: 'CANCELLED' });
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
      setEstimatedFee(null);
    }
  }

  async function handleModifyRate(): Promise<void> {
    if (!address || !client) return;

    setPending('modifyRate');
    try {
      // Re-fetch the stream's balance immediately before computing the new
      // rate, rather than trusting `stream.balance` (issue #159): that prop
      // is only as fresh as this component's last render, and the balance
      // moves on its own as the stream drains between then and now, or
      // could have changed from a top-up/withdrawal elsewhere. Rating
      // against a stale number targets a balance that no longer exists,
      // making the stream run out earlier or later than the donor intended.
      // This still polls the same indexer-backed list endpoint onChanged()
      // itself uses (see INDEXING_LAG_NOTE below), so it is the freshest
      // balance available here, not a guarantee of exact on-chain accuracy.
      const freshStreams = await getStreams({ donor: address });
      const freshStream = freshStreams.find((s) => s.id === stream.id);
      if (!freshStream) {
        showToast(
          'error',
          "Couldn't find this stream's current balance — it may have been cancelled.",
        );
        return;
      }

      // Re-rate the stream's *remaining* balance over a newly chosen
      // duration — asking a donor for a raw per-second rate makes no more
      // sense here than it did on the create-stream form.
      const newRate = computeModifyRate(freshStream.balance, durationSeconds);
      if (newRate === null) {
        showToast('error', 'Remaining balance is too small to stream over this duration.');
        return;
      }

      // Only now is submission actually going ahead -- stay in "modifying"
      // mode (duration picker visible) until this point so a validation
      // failure above leaves the donor able to immediately try a shorter
      // duration, instead of being kicked back to the idle button row.
      setMode('idle');
      const tx = await client.modify_rate({
        stream_id: BigInt(stream.onChainId),
        new_rate: newRate,
      });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      await tx.signAndSend();
      showToast('success', `Rate updated — ${INDEXING_LAG_NOTE}.`);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
      setEstimatedFee(null);
    }
  }

  if (mode === 'toppingUp') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={topUpAmount}
          onChange={(event) => setTopUpAmount(event.target.value)}
          placeholder="Amount"
          aria-label="Amount to add to this stream"
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:focus-visible:ring-teal-400"
        />
        <button
          type="button"
          onClick={() => void handleTopUp()}
          disabled={topUpAmountRaw === null}
          className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:bg-white dark:text-black dark:focus-visible:ring-teal-400"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:focus-visible:ring-teal-400"
        >
          Back
        </button>
      </div>
    );
  }

  if (mode === 'confirmingCancel') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Cancel this stream? This can&apos;t be undone.
        </span>
        <button
          type="button"
          onClick={() => void handleCancel()}
          className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:bg-red-500 dark:hover:bg-red-600 dark:focus-visible:ring-teal-400"
        >
          Yes, cancel
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:focus-visible:ring-teal-400"
        >
          Never mind
        </button>
      </div>
    );
  }

  if (mode === 'modifying') {
    const previewRate = computeModifyRate(stream.balance, durationSeconds);
    const previewEndDate = new Date(Date.now() + durationSeconds * 1000);

    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <select
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(Number(event.target.value))}
            aria-label="New duration to stream the remaining balance over"
            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:bg-gray-900 dark:focus-visible:ring-teal-400"
          >
            {DURATIONS.map((d) => (
              <option key={d.seconds} value={d.seconds}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleModifyRate()}
            className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:bg-white dark:text-black dark:focus-visible:ring-teal-400"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:focus-visible:ring-teal-400"
          >
            Back
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {previewRate !== null
            ? `${(Number(previewRate) / 10 ** TOKEN_DECIMALS).toFixed(7)} per second, ending ${previewEndDate.toLocaleDateString()}.`
            : 'Remaining balance is too small to stream over this duration — try a shorter one.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!ready && (
        <span role="status" className="text-xs text-gray-400 dark:text-gray-500">
          Preparing contract…
        </span>
      )}
      {pending !== null && estimatedFee && (
        <span className="text-xs text-gray-500 dark:text-gray-400">Fee {estimatedFee}</span>
      )}
      <button
        type="button"
        onClick={() => setMode('toppingUp')}
        disabled={pending !== null || !ready}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:focus-visible:ring-teal-400"
      >
        {pending === 'topUp' ? 'Topping up…' : 'Top up'}
      </button>
      <button
        type="button"
        onClick={() => setMode('modifying')}
        disabled={pending !== null || !ready}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:focus-visible:ring-teal-400"
      >
        {pending === 'modifyRate' ? 'Updating…' : 'Modify rate'}
      </button>
      <button
        type="button"
        onClick={() => setMode('confirmingCancel')}
        disabled={pending !== null || !ready}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:focus-visible:ring-teal-400"
      >
        {pending === 'cancel' ? 'Cancelling…' : 'Cancel'}
      </button>
    </div>
  );
}
