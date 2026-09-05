'use client';

import { useState, type FormEvent } from 'react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { useWallet } from '@/components/wallet/WalletProvider';
import { ApiError, submitNgoApplication } from '@/lib/api';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function ApplyPage() {
  const { address, connect } = useWallet();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit =
    !!address &&
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    contactEmail.trim().length > 0 &&
    status !== 'submitting';

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || !address) return;

    setStatus('submitting');
    setErrorMessage(null);
    try {
      await submitNgoApplication({
        ownerAddress: address,
        name: name.trim(),
        description: description.trim(),
        contactEmail: contactEmail.trim(),
        website: website.trim() || undefined,
        country: country.trim() || undefined,
      });
      setStatus('success');
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <>
        <Header />
        <main className="px-6 py-16 sm:px-12">
          <div className="max-w-md rounded-lg border border-green-200 bg-green-50 p-6">
            <p className="font-medium text-green-800">Application submitted!</p>
            <p className="mt-1 text-sm text-green-700">
              We&apos;ll review it and reach out at the contact email you provided.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Apply as an NGO</h1>
        <p className="mt-2 max-w-md text-sm text-gray-600">
          Connect the wallet your organization will use to receive donations, then tell us about
          your NGO.
        </p>

        {!address ? (
          <div className="mt-8 max-w-md rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600">Connect your wallet to apply.</p>
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 max-w-md space-y-6">
            <label className="block">
              <span className="text-sm font-medium">Organization name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={4}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Contact email</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Website (optional)</span>
              <input
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Country (optional)</span>
              <input
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <p className="text-xs break-all text-gray-500">
              Applying as <span className="font-mono">{address}</span>
            </p>

            {status === 'error' && errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {status === 'submitting' ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
