'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AssembledTransaction } from '@stellar/stellar-sdk/contract';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { CopyAddressButton } from '@/components/common/CopyAddressButton';
import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { Ngo, NgoApplication } from '@/lib/api';
import { getNgos } from '@/lib/api';
import { listNgoApplications, reviewNgoApplication } from '@/lib/adminApi';
import { formatEstimatedFee, truncateAddress } from '@/lib/format';
import { useNgoRegistryClient } from '@/lib/ngoRegistryClient';
import { useLatestRequest } from '@/lib/useLatestRequest';

export default function PlatformAdminPage() {
  const { address, signMessage } = useWallet();
  const { client, ready, initError, retryInit } = useNgoRegistryClient();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<NgoApplication[]>([]);
  const [totalApplications, setTotalApplications] = useState(0);
  const [verifiedNgos, setVerifiedNgos] = useState<Ngo[]>([]);
  // Starts true so the "no applications" state isn't painted before the
  // first fetch begins.
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingRejectId, setConfirmingRejectId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  // The id of the application awaiting a second click, and the already-
  // built (not yet signed) tx for it — built once, during the first click,
  // so confirming signs the exact tx the fee estimate was shown for instead
  // of re-simulating it.
  const [confirmingApproveId, setConfirmingApproveId] = useState<string | null>(null);
  const [pendingApproveTx, setPendingApproveTx] = useState<AssembledTransaction<null> | null>(
    null,
  );

  // Only the most recently started refresh may write state, so a slow
  // response for a previous status tab or wallet can't overwrite newer data.
  const { begin, cancel } = useLatestRequest();

  const refresh = useCallback(async () => {
    if (!address) {
      cancel();
      return;
    }
    const request = begin();
    setLoading(true);
    setError(null);
    try {
      const [page, ngos] = await Promise.all([
        listNgoApplications(address, signMessage, statusFilter),
        getNgos(request.signal),
      ]);
      if (!request.isCurrent()) return;
      setApplications(page.applications);
      setTotalApplications(page.total);
      setVerifiedNgos(ngos.filter(n => n.verified));
    } catch (err) {
      if (!request.isCurrent()) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load applications — are you connected as the configured admin address?',
      );
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [address, signMessage, statusFilter, begin, cancel]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleLoadMore(): Promise<void> {
    if (!address) return;
    setLoadingMore(true);
    try {
      const page = await listNgoApplications(address, signMessage, statusFilter, applications.length);
      // Append — don't replace — so rows already visible stay put.
      setApplications((prev) => [...prev, ...page.applications]);
      setTotalApplications(page.total);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load more applications.');
    } finally {
      setLoadingMore(false);
    }
  }

  const [retryApprovingId, setRetryApprovingId] = useState<string | null>(null);

  // Builds the (unsigned) approve tx and shows its fee estimate so the
  // admin can confirm before anything is signed. Building just simulates
  // the call — it doesn't touch the wallet or submit anything.
  async function handleApproveClick(app: NgoApplication): Promise<void> {
    if (!address || !client) return;
    setBusyId(app.id);
    try {
      const tx = await client.approve_ngo({ ngo_owner: app.ownerAddress });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      setPendingApproveTx(tx);
      setConfirmingApproveId(app.id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  function handleCancelApprove(): void {
    setConfirmingApproveId(null);
    setPendingApproveTx(null);
    setEstimatedFee(null);
  }

  async function handleConfirmApprove(app: NgoApplication): Promise<void> {
    const isRetry = retryApprovingId === app.id;
    if (!address || (!isRetry && !pendingApproveTx)) return;
    setBusyId(app.id);
    let onChainDone = isRetry;
    try {
      // On-chain first: this is what actually flips Ngo.verified once the
      // indexer picks up the resulting event. If the wallet rejects or the
      // tx fails, we deliberately haven't touched the off-chain review
      // status yet — better an application stuck "pending" than one
      // marked "approved" while the NGO is still unverified on-chain.
      if (!isRetry) {
        await pendingApproveTx!.signAndSend();
        onChainDone = true;
      }

      // Now mark off-chain. If this fails, the NGO is already verified on-chain
      // but the app is still PENDING — surface a targeted retry action.
      await reviewNgoApplication(address, signMessage, app.id, 'approve', reviewNotes[app.id]);
      showToast('success', `${app.name} approved.`);
      setRetryApprovingId(null);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      // Once the on-chain approval has gone through, any failure is in the
      // off-chain marking — show the retry-marking-approved action.
      if (onChainDone) {
        showToast('error', `Couldn't mark as approved: ${message}`);
        setRetryApprovingId(app.id);
      } else {
        showToast('error', message);
        setRetryApprovingId(null);
      }
    } finally {
      setBusyId(null);
      setConfirmingApproveId(null);
      setPendingApproveTx(null);
      setEstimatedFee(null);
    }
  }

  function handleRetryMarkApproved(app: NgoApplication): void {
    void handleConfirmApprove(app);
  }

  async function handleReject(app: NgoApplication): Promise<void> {
    if (!address) return;
    setBusyId(app.id);
    try {
      await reviewNgoApplication(address, signMessage, app.id, 'reject', reviewNotes[app.id]);
      showToast('info', `${app.name} rejected.`);
      setConfirmingRejectId(null);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(ngo: Ngo): Promise<void> {
    if (!address || !client) return;
    setBusyId(ngo.id);
    try {
      const tx = await client.revoke_ngo({ ngo_owner: ngo.ownerAddress });
      await tx.signAndSend();
      showToast('success', `${ngo.name} revoked.`);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
      setRevokeConfirmId(null);
    }
  }

  return (
    <main id="main" className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Platform admin</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
          Review pending NGO applications. Only the wallet configured as the platform&apos;s
          <code className="mx-1 rounded bg-gray-100 px-1 dark:bg-gray-800">ADMIN_ADDRESS</code>
          can act here — approving both calls the on-chain registry and records the review.
        </p>

        {!address && (
          <ConnectWalletPrompt className="mt-8" message="Connect the platform admin wallet." />
        )}

        {address && initError && (
          <div className="mt-8">
            <p className="text-red-600 dark:text-red-400">{initError}</p>
            <button
              type="button"
              onClick={retryInit}
              className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {address && (
          <div className="mt-8 border-b border-gray-200 dark:border-gray-800">
            <div role="tablist" aria-label="Application status" className="-mb-px flex space-x-8">
              {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                  className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400 ${
                    statusFilter === status
                      ? 'border-black text-black dark:border-white dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {address && error && <p className="mt-8 text-red-600 dark:text-red-400">{error}</p>}

        {address && !loading && !error && applications.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">No {statusFilter.toLowerCase()} applications.</p>
        )}

        {address && !loading && applications.length > 0 && (
          <ul className="mt-8 space-y-4">
            {applications.map((app) => (
              <li
                key={app.id}
                className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{app.name}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {app.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {app.contactEmail}
                      {app.website ? ` · ${app.website}` : ''}
                      {app.country ? ` · ${app.country}` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {truncateAddress(app.ownerAddress)}
                      </p>
                      <CopyAddressButton address={app.ownerAddress} />
                    </div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Submitted{' '}
                      {new Date(app.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
                    {statusFilter === 'PENDING' ? (
                      <>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Review note (optional)
                      </span>
                      <textarea
                        value={reviewNotes[app.id] ?? ''}
                        onChange={(event) =>
                          setReviewNotes((notes) => ({ ...notes, [app.id]: event.target.value }))
                        }
                        rows={2}
                        placeholder="Why is this approved or rejected?"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                    </label>
                    <div className="flex gap-2">
                      {confirmingApproveId === app.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Approve {app.name}?
                            {estimatedFee ? ` Estimated fee: ${estimatedFee}.` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleConfirmApprove(app)}
                            disabled={busyId === app.id}
                            className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                          >
                            {busyId === app.id ? 'Working…' : 'Yes, approve'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelApprove}
                            disabled={busyId === app.id}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
                          >
                            Never mind
                          </button>
                        </div>
                      ) : confirmingRejectId === app.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Reject this application?
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleReject(app)}
                            disabled={busyId === app.id}
                            className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                          >
                            {busyId === app.id ? 'Working…' : 'Yes, reject'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRejectId(null)}
                            disabled={busyId === app.id}
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
                          >
                            Never mind
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleApproveClick(app)}
                            disabled={busyId === app.id}
                            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                          >
                            {busyId === app.id ? 'Working…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRejectId(app.id)}
                            disabled={busyId === app.id}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                    {retryApprovingId === app.id && (
                      <div className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-amber-50 p-2 dark:bg-amber-900/20">
                        <span className="text-xs text-amber-900 dark:text-amber-200">
                          NGO verified on-chain but couldn't mark approved in the system.
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleRetryMarkApproved(app)}
                          disabled={busyId === app.id}
                          className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
                        >
                          {busyId === app.id ? 'Retrying…' : 'Retry marking approved'}
                        </button>
                      </div>
                    )}
                      </>
                    ) : (
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Review note
                        </span>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {app.reviewNote || 'No note provided.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {address && !loading && applications.length > 0 && applications.length < totalApplications && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {loadingMore
                ? 'Loading…'
                : `Load more (${applications.length} of ${totalApplications})`}
            </button>
          </div>
        )}

        {address && !loading && !error && (
          <div className="mt-16">
            <h2 className="text-xl font-bold">Verified NGOs</h2>
            {verifiedNgos.length === 0 ? (
              <p className="mt-4 text-gray-600 dark:text-gray-400">No verified NGOs.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {verifiedNgos.map((ngo) => (
                  <li
                    key={ngo.id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"
                  >
                    <div>
                      <h3 className="font-semibold">{ngo.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {truncateAddress(ngo.ownerAddress)}
                        </p>
                        <CopyAddressButton address={ngo.ownerAddress} />
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Registered{' '}
                        {new Date(ngo.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {revokeConfirmId === ngo.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setRevokeConfirmId(null)}
                            disabled={busyId === ngo.id}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(ngo)}
                            disabled={busyId === ngo.id}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {busyId === ngo.id ? 'Working…' : 'Confirm Revoke'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevokeConfirmId(ngo.id)}
                          disabled={busyId === ngo.id}
                          className="rounded-md border border-red-200 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-500 dark:hover:bg-red-900/20"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
  );
}
