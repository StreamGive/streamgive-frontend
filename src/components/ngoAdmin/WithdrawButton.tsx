'use client';

import { useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getDonationVaultClient } from '@/lib/donationVaultClient';

export function WithdrawButton({
  streamOnChainId,
  onWithdrawn,
}: {
  streamOnChainId: string;
  onWithdrawn: () => void;
}) {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleWithdraw(): Promise<void> {
    if (!address) return;
    setBusy(true);
    try {
      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.withdraw({ stream_id: BigInt(streamOnChainId) });
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
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleWithdraw()}
      disabled={busy}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
    >
      {busy ? 'Withdrawing…' : 'Withdraw'}
    </button>
  );
}
