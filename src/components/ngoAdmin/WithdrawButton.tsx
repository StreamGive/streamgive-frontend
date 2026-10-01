'use client';

import { useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useDonationVaultClient } from '@/lib/donationVaultClient';
import { formatEstimatedFee } from '@/lib/format';

export function WithdrawButton({
  streamOnChainId,
  onWithdrawn,
}: {
  streamOnChainId: string;
  onWithdrawn: () => void;
}) {
  const { address } = useWallet();
  const { client, ready } = useDonationVaultClient();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  async function handleWithdraw(): Promise<void> {
    if (!address || !client) return;
    setBusy(true);
    try {
      const tx = await client.withdraw({ stream_id: BigInt(streamOnChainId) });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      await tx.signAndSend();
      showToast('success', 'Withdrawal submitted — may take a few seconds to show below.');
      onWithdrawn();
    } catch (err) {
      // The contract returns NothingToWithdraw when nothing's accrued yet
      // — a normal outcome, not a bug — but friendlier per-error-code
      // messages are a later polish pass, not this one.
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setEstimatedFee(null);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {busy && estimatedFee && (
        <span className="text-xs text-gray-500 dark:text-gray-400">Fee {estimatedFee}</span>
      )}
      <button
        type="button"
        onClick={() => void handleWithdraw()}
        disabled={busy || !ready}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:focus-visible:ring-teal-400"
      >
        {busy ? 'Withdrawing…' : ready ? 'Withdraw' : 'Loading…'}
      </button>
    </span>
  );
}
