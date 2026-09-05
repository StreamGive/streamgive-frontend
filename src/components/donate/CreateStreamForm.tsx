'use client';

import { useState, type FormEvent } from 'react';

import { useWallet } from '@/components/wallet/WalletProvider';
import { getDonationVaultClient } from '@/lib/donationVaultClient';
import { getNativeAssetAddress } from '@/lib/stellar';

const DURATIONS = [
  { label: '1 week', seconds: 7 * 24 * 60 * 60 },
  { label: '1 month', seconds: 30 * 24 * 60 * 60 },
  { label: '3 months', seconds: 90 * 24 * 60 * 60 },
  { label: '1 year', seconds: 365 * 24 * 60 * 60 },
];

// Every Stellar Asset Contract token (native XLM included) uses 7 decimal
// places — that's fixed by the protocol, not something per-asset to look up.
const TOKEN_DECIMALS = 7;

type TokenChoice = 'native' | 'custom';
type SubmitState = 'idle' | 'signing' | 'success' | 'error';

export function CreateStreamForm({ ngoAddress }: { ngoAddress: string }) {
  const { address, connect, signTransaction } = useWallet();

  const [tokenChoice, setTokenChoice] = useState<TokenChoice>('native');
  const [customToken, setCustomToken] = useState('');
  const [amount, setAmount] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[1].seconds);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);

  const amountNumber = Number(amount);
  const isAmountValid = Number.isFinite(amountNumber) && amountNumber > 0;

  const depositRaw = isAmountValid
    ? BigInt(Math.round(amountNumber * 10 ** TOKEN_DECIMALS))
    : null;
  const rateRaw = depositRaw !== null ? depositRaw / BigInt(durationSeconds) : null;
  const isRateValid = rateRaw !== null && rateRaw > 0n;

  const isTokenValid = tokenChoice === 'native' || customToken.trim().length > 0;
  const canSubmit = isAmountValid && isRateValid && isTokenValid && submitState !== 'signing';

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || !address || depositRaw === null || rateRaw === null) {
      return;
    }

    setSubmitState('signing');
    setErrorMessage(null);

    try {
      const tokenAddress =
        tokenChoice === 'native' ? getNativeAssetAddress() : customToken.trim();

      const client = await getDonationVaultClient(address, signTransaction);
      const tx = await client.create_stream({
        donor: address,
        ngo: ngoAddress,
        token: tokenAddress,
        deposit: depositRaw,
        rate: rateRaw,
      });
      const { result } = await tx.signAndSend();

      setStreamId(String(result));
      setSubmitState('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitState('error');
    }
  }

  if (submitState === 'success' && streamId !== null) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <p className="font-medium text-green-800">Stream started!</p>
        <p className="mt-1 text-sm text-green-700">Stream #{streamId} is now active.</p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-600">Connect your wallet to start a stream.</p>
        <button
          type="button"
          onClick={() => void connect()}
          className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="max-w-md space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Token</legend>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="token"
              checked={tokenChoice === 'native'}
              onChange={() => setTokenChoice('native')}
            />
            XLM (native)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="token"
              checked={tokenChoice === 'custom'}
              onChange={() => setTokenChoice('custom')}
            />
            Custom asset
          </label>
        </div>
        {tokenChoice === 'custom' && (
          <input
            type="text"
            value={customToken}
            onChange={(event) => setCustomToken(event.target.value)}
            placeholder="Token contract address (C...)"
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        )}
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium">Total amount</span>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="100"
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Stream over</span>
        <select
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(Number(event.target.value))}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {DURATIONS.map((d) => (
            <option key={d.seconds} value={d.seconds}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      {isAmountValid && rateRaw !== null && (
        <p className="text-sm text-gray-500">
          {isRateValid
            ? `That's roughly ${(Number(rateRaw) / 10 ** TOKEN_DECIMALS).toFixed(7)} per second.`
            : 'That amount is too small to stream over this duration — try a shorter one.'}
        </p>
      )}

      {submitState === 'error' && errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {submitState === 'signing' ? 'Confirm in your wallet…' : 'Review & Sign'}
      </button>
    </form>
  );
}
