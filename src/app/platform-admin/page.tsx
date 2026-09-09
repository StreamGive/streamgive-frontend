'use client';

import { useCallback, useEffect, useState } from 'react';

import { CopyAddressButton } from '@/components/common/CopyAddressButton';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { NgoApplication } from '@/lib/api';
import { listNgoApplications, reviewNgoApplication } from '@/lib/adminApi';
import { truncateAddress } from '@/lib/format';
import { getNgoRegistryClient } from '@/lib/ngoRegistryClient';

export default function PlatformAdminPage() {
  const { address, connect, signMessage, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<NgoApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      setApplications(await listNgoApplications(address, signMessage, 'PENDING'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load applications — are you connected as the configured admin address?',
      );
    } finally {
      setLoading(false);
    }
  }, [address, signMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleApprove(app: NgoApplication): Promise<void> {
    if (!address) return;
    setBusyId(app.id);
    try {
      // On-chain first: this is what actually flips Ngo.verified once the
      // indexer picks up the resulting event. If the wallet rejects or the
      // tx fails, we deliberately haven't touched the off-chain review
      // status yet — better an application stuck "pending" than one
      // marked "approved" while the NGO is still unverified on-chain.
      const client = await getNgoRegistryClient(address, signTransaction);
      const tx = await client.approve_ngo({ ngo_owner: app.ownerAddress });
      await tx.signAndSend();

      await reviewNgoApplication(address, signMessage, app.id, 'approve');
      showToast('success', `${app.name} approved.`);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(app: NgoApplication): Promise<void> {
    if (!address) return;
    setBusyId(app.id);
    try {
      await reviewNgoApplication(address, signMessage, app.id, 'reject');
      showToast('info', `${app.name} rejected.`);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Platform admin</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-600">
          Review pending NGO applications. Only the wallet configured as the platform's
          <code className="mx-1 rounded bg-gray-100 px-1">ADMIN_ADDRESS</code>
          can act here — approving both calls the on-chain registry and records the review.
        </p>

        {!address && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-600">Connect the platform admin wallet.</p>
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500">
            Loading…
          </p>
        )}

        {address && error && <p className="mt-8 text-red-600">{error}</p>}

        {address && !loading && !error && applications.length === 0 && (
          <p className="mt-8 text-gray-600">No pending applications.</p>
        )}

        {address && !loading && applications.length > 0 && (
          <ul className="mt-8 space-y-4">
            {applications.map((app) => (
              <li key={app.id} className="rounded-lg border border-gray-200 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{app.name}</h2>
                    <p className="mt-1 text-sm text-gray-600">{app.description}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {app.contactEmail}
                      {app.website ? ` · ${app.website}` : ''}
                      {app.country ? ` · ${app.country}` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-xs text-gray-500">
                        {truncateAddress(app.ownerAddress)}
                      </p>
                      <CopyAddressButton address={app.ownerAddress} />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleApprove(app)}
                      disabled={busyId === app.id}
                      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {busyId === app.id ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(app)}
                      disabled={busyId === app.id}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
