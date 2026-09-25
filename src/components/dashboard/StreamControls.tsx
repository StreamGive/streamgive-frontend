'use client';

import { useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { Stream } from '@/lib/api';
import { getDonationVaultClient } from '@/lib/donationVaultClient';
import { parseAmount } from '@/lib/format';

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

export function StreamControls({ stream, onChanged }: { stream: Stream; onChanged: () => void }) {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [pending, setPending] = useState<PendingAction>(null);
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[1].seconds);
  const [topUpAmount, setTopUpAmount] = useState('');

  const topUpAmountRaw = parseAmount(topUpAmount);

  async function handleTopUp(): Promise<void> {
    if (!address || topUpAmountRaw === null) return;

    setMode('idle');
    setPending('topUp');
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.top_up({
        stream_id: BigInt(stream.onChainId),
        amount: topUpAmountRaw,
      });
      await tx.signAndSend();
      showToast('success', `Stream topped up — ${INDEXING_LAG_NOTE}.`);
      setTopUpAmount('');
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!address) return;
    setMode('idle');
    setPending('cancel');
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.cancel_stream({ stream_id: BigInt(stream.onChainId) });
      await tx.signAndSend();
      showToast('success', `Stream cancelled — ${INDEXING_LAG_NOTE}.`);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
    }
  }

  async function handleModifyRate(): Promise<void> {
    if (!address) return;

    // Re-rate the stream's *remaining* balance over a newly chosen
    // duration — asking a donor for a raw per-second rate makes no more
    // sense here than it did on the create-stream form.
    const newRate = BigInt(stream.balance) / BigInt(durationSeconds);
    if (newRate <= 0n) {
      showToast('error', 'Remaining balance is too small to stream over this duration.');
      return;
    }

    setMode('idle');
    setPending('modifyRate');
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.modify_rate({
        stream_id: BigInt(stream.onChainId),
        new_rate: newRate,
      });
      await tx.signAndSend();
      showToast('success', `Rate updated — ${INDEXING_LAG_NOTE}.`);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(null);
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
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700"
        />
        <button
          type="button"
          onClick={() => void handleTopUp()}
          disabled={topUpAmountRaw === null}
          className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium dark:border-gray-700"
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
          className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
        >
          Yes, cancel
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium dark:border-gray-700"
        >
          Never mind
        </button>
      </div>
    );
  }

  if (mode === 'modifying') {
    return (
      <div className="flex items-center gap-2">
        <select
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(Number(event.target.value))}
          aria-label="New duration to stream the remaining balance over"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
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
          className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium dark:border-gray-700"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => setMode('toppingUp')}
        disabled={pending !== null}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {pending === 'topUp' ? 'Topping up…' : 'Top up'}
      </button>
      <button
        type="button"
        onClick={() => setMode('modifying')}
        disabled={pending !== null}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {pending === 'modifyRate' ? 'Updating…' : 'Modify rate'}
      </button>
      <button
        type="button"
        onClick={() => setMode('confirmingCancel')}
        disabled={pending !== null}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {pending === 'cancel' ? 'Cancelling…' : 'Cancel'}
      </button>
    </div>
  );
}
