'use client';

import { useState } from 'react';

import { useWallet } from '@/components/wallet/WalletProvider';
import type { Stream } from '@/lib/api';
import { getDonationVaultClient } from '@/lib/donationVaultClient';

const DURATIONS = [
  { label: '1 week', seconds: 7 * 24 * 60 * 60 },
  { label: '1 month', seconds: 30 * 24 * 60 * 60 },
  { label: '3 months', seconds: 90 * 24 * 60 * 60 },
  { label: '1 year', seconds: 365 * 24 * 60 * 60 },
];

type Mode = 'idle' | 'modifying' | 'busy';

export function StreamControls({ stream, onChanged }: { stream: Stream; onChanged: () => void }) {
  const { address, signTransaction } = useWallet();
  const [mode, setMode] = useState<Mode>('idle');
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[1].seconds);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(): Promise<void> {
    if (!address) return;
    setMode('busy');
    setError(null);
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.cancel_stream({ stream_id: BigInt(stream.onChainId) });
      await tx.signAndSend();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
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
      setError('Remaining balance is too small to stream over this duration.');
      return;
    }

    setMode('busy');
    setError(null);
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.modify_rate({
        stream_id: BigInt(stream.onChainId),
        new_rate: newRate,
      });
      await tx.signAndSend();
      onChanged();
      setMode('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setMode('idle');
    }
  }

  if (mode === 'modifying') {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <select
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(Number(event.target.value))}
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
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex shrink-0 gap-2">
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
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
