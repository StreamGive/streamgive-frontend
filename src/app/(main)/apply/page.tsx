'use client';

import { useEffect, useState, useRef, type FormEvent } from 'react';

import { ApplicationStatusPanel } from '@/components/apply/ApplicationStatusPanel';
import { useWallet } from '@/components/wallet/WalletProvider';
import {
  ApiError,
  getApplicationStatus,
  submitNgoApplication,
  type NgoApplicationStatus,
} from '@/lib/api';
import { NGO_REGISTRY_ERRORS } from '@/lib/contractTypes';
import { formatEstimatedFee } from '@/lib/format';
import { useNgoRegistryClient } from '@/lib/ngoRegistryClient';

type Status = 'idle' | 'registering' | 'submitting' | 'success' | 'error';

// Mirrors the backend's zod schema for NGO applications.
const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;
const COUNTRY_MAX_LENGTH = 100;

/** True when a failed contract call is ngo-registry reporting that this
  * address is already in the registry. Re-applying after a part-finished
  * attempt is normal, so that is a no-op to step over, not an error. */
function isAlreadyRegistered(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes(`#${NGO_REGISTRY_ERRORS.ALREADY_REGISTERED}`);
}

export default function ApplyPage() {
  const { address, connecting, connect } = useWallet();
  const { client, ready } = useNgoRegistryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  // Keyed by the address it was fetched for, so a result for a previous
  // wallet is never shown after switching to another one.
  const [fetchedApplication, setFetchedApplication] = useState<{
    address: string;
    application: NgoApplicationStatus | null;
  } | null>(null);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    getApplicationStatus(address)
      .then((application) => {
        if (!cancelled) setFetchedApplication({ address, application });
      })
      // The status panel is a convenience — if the lookup fails, the form
      // stays available as before.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [address]);

  const application =
    fetchedApplication?.address === address ? fetchedApplication.application : null;
  // A pending or approved applicant has nothing left to submit; a rejected
  // one may be able to re-apply, so the form stays below their result.
  const showForm = !application || application.status === 'REJECTED';

  const canSubmit =
    !!address &&
    !!client &&
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    contactEmail.trim().length > 0 &&
    status !== 'submitting' &&
    status !== 'registering';

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || !address || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setErrorMessage(null);

    // On-chain first. approve_ngo fails with NotRegistered until the
    // address exists in the registry, so an application without a
    // matching register() is one the admin can never actually approve.
    // register() requires the owner's own signature, which is also what
    // makes the ownerAddress below a proven claim rather than a typed-in
    // one.
    setStatus('registering');
    try {
      const tx = await client.register({ owner: address, name: name.trim() });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      await tx.signAndSend();
    } catch (err) {
      if (!isAlreadyRegistered(err)) {
        setErrorMessage(
          err instanceof Error
            ? `Could not register on-chain: ${err.message}`
            : 'Could not register on-chain.',
        );
        setStatus('error');
        isSubmittingRef.current = false;
        return;
      }
      // Already in the registry from an earlier attempt — carry on.
    } finally {
      setEstimatedFee(null);
    }

    setStatus('submitting');
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
      isSubmittingRef.current = false;
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
      setStatus('error');
      isSubmittingRef.current = false;
    }
  }

  if (status === 'success') {
    return (
      <main id="main" className="px-6 py-16 sm:px-12">
        <div className="max-w-md rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
          <p className="font-medium text-green-800 dark:text-green-300">
            Application submitted!
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            We&apos;ll review it and reach out at the contact email you provided.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Apply as an NGO</h1>
        <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          Connect the wallet your organization will use to receive donations, then tell us about
          your NGO. Submitting registers that address in the on-chain registry, so your wallet
          will ask you to sign one transaction — that signature is what proves the address is
          yours.
        </p>

        {!address && connecting ? (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        ) : !address ? (
          <div className="mt-8 max-w-md rounded-lg border border-gray-200 p-6 text-center dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Connect your wallet to apply.</p>
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {application && <ApplicationStatusPanel application={application} />}
            {showForm && (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 max-w-md space-y-6">
            <label className="block">
              <span className="text-sm font-medium">Organization name</span>
              <input
                type="text"
                autoComplete="organization"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={NAME_MAX_LENGTH}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={4}
                maxLength={DESCRIPTION_MAX_LENGTH}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {description.length} / {DESCRIPTION_MAX_LENGTH}
              </p>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Contact email</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Website (optional)</span>
              <input
                type="url"
                autoComplete="url"
                inputMode="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Country (optional)</span>
              <input
                type="text"
                autoComplete="country-name"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                maxLength={COUNTRY_MAX_LENGTH}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>

            <p className="text-xs break-all text-gray-500 dark:text-gray-400">
              Applying as <span className="font-mono">{address}</span>
            </p>

            {status === 'registering' && estimatedFee && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Estimated network fee: {estimatedFee}
              </p>
            )}

            {status === 'error' && errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex justify-center items-center gap-2 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {(status === 'registering' || status === 'submitting') && (
                <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
              )}
              {status === 'registering'
                ? 'Confirm in your wallet…'
                : status === 'submitting'
                  ? 'Submitting…'
                  : !ready
                    ? 'Preparing contract…'
                    : 'Submit application'}
            </button>
          </form>
            )}
          </>
        )}
      </main>
  );
}
