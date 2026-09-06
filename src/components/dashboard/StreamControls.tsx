'use client';

import { useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { Stream } from '@/lib/api';
import { getDonationVaultClient } from '@/lib/donationVaultClient';

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

type Mode = 'idle' | 'modifying' | 'busy';

export function StreamControls({ stream, onChanged }: { stream: Stream; onChanged: () => void }) {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[1].seconds);

  async function handleCancel(): Promise<void> {
    if (!address) return;
    setMode('busy');
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.cancel_stream({ stream_id: BigInt(stream.onChainId) });
      await tx.signAndSend();
      showToast('success', `Stream cancelled — ${INDEXING_LAG_NOTE}.`);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setMode('idle');
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

    setMode('busy');
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
      setMode('idle');
    }
  }

  if (mode === 'modifying') {
    return (
      <div className="flex items-center gap-2">
        <select
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(Number(event.target.value))}
          aria-label="New duration to stream the remaining balance over"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
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
          className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setMode('idle')}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium"
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
        disabled
        title="Coming soon"
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        Top up
      </button>
      <button
        type="button"
        onClick={() => setMode('modifying')}
        disabled={mode === 'busy'}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        Modify rate
      </button>
      <button
        type="button"
        onClick={() => void handleCancel()}
        disabled={mode === 'busy'}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {mode === 'busy' ? 'Cancelling…' : 'Cancel'}
      </button>
    </div>
  );
}
