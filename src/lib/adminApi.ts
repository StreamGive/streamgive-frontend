import type { WalletSignMessage } from '@/components/wallet/WalletProvider';

import type { NgoApplication } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** The backend accepts a signature within MAX_CLOCK_SKEW_MS (5 minutes) of
  * its timestamp, so one we just made stays valid for that long. Reused up
  * to a minute short of the limit, to leave room for clock drift between
  * this machine and the server, and for the request itself to land.
  *
  * Reuse grants nothing the server would not already have accepted: same
  * address, same method, same path, same expiry. It only stops us throwing
  * away a live signature and prompting the wallet again for an identical
  * one - which is what made every visit to the admin page pop a dialog. */
const SIGNATURE_REUSE_WINDOW_MS = 4 * 60 * 1000;

type CachedSignature = { signature: string; timestamp: string; signedAt: number };

// Module-level and in-memory on purpose: it survives client-side navigation
// away and back, and is gone on a full reload or tab close. Putting it in
// storage would outlive the page for no real gain.
const signatureCache = new Map<string, CachedSignature>();

async function getSignature(
  cacheKey: string,
  method: string,
  path: string,
  signMessage: WalletSignMessage,
): Promise<{ cached: CachedSignature; wasReused: boolean }> {
  const existing = signatureCache.get(cacheKey);
  if (existing && Date.now() - existing.signedAt < SIGNATURE_REUSE_WINDOW_MS) {
    return { cached: existing, wasReused: true };
  }

  const timestamp = Date.now().toString();
  const signature = await signMessage(`${method}:${path}:${timestamp}`);
  const cached = { signature, timestamp, signedAt: Date.now() };
  signatureCache.set(cacheKey, cached);
  return { cached, wasReused: false };
}

/** Mirrors the backend's requireAdminSignature exactly: signs
 * `${method}:${path}:${timestamp}` and sends the pieces as headers. `path`
 * must match what Fastify sees as `request.url` — origin excluded, query
 * string included if present. */
async function adminFetch(
  method: string,
  path: string,
  address: string,
  signMessage: WalletSignMessage,
  body?: unknown,
): Promise<Response> {
  const cacheKey = `${address}:${method}:${path}`;

  const send = async (cached: CachedSignature) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-admin-address': address,
        'x-admin-signature': cached.signature,
        'x-admin-timestamp': cached.timestamp,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const { cached, wasReused } = await getSignature(cacheKey, method, path, signMessage);
  const res = await send(cached);

  // A reused signature can still be rejected - the server clock may sit
  // further ahead than the margin above allows. Retry once with a fresh
  // one so that shows up as a single extra prompt rather than a dead page.
  // Only when it was reused: a fresh signature that 401s means the wrong
  // wallet is connected, and re-prompting would not change that.
  if (res.status === 401 && wasReused) {
    signatureCache.delete(cacheKey);
    const retry = await getSignature(cacheKey, method, path, signMessage);
    return send(retry.cached);
  }

  return res;
}

/** The paginated envelope GET /ngo-applications responds with. The other
  * list endpoints return bare arrays; this one does not. */
type NgoApplicationPage = {
  applications: NgoApplication[];
  total: number;
  limit: number;
  offset: number;
};

export async function listNgoApplications(
  address: string,
  signMessage: WalletSignMessage,
  status?: 'PENDING' | 'APPROVED' | 'REJECTED',
): Promise<NgoApplication[]> {
  const path = status ? `/ngo-applications?status=${status}` : '/ngo-applications';
  const res = await adminFetch('GET', path, address, signMessage);
  if (!res.ok) {
    throw new Error(`Failed to fetch applications: ${res.status}`);
  }

  const body = (await res.json()) as NgoApplicationPage;

  // Checked rather than assumed. This endpoint used to return a bare array
  // and grew an envelope when pagination was added; the mismatch surfaced
  // as a page that rendered neither the list nor its empty state, because
  // `undefined > 0` and `undefined === 0` are both false. Fail loudly if
  // the shape moves again.
  if (!Array.isArray(body?.applications)) {
    throw new Error(
      'Unexpected response from /ngo-applications: expected an { applications: [...] } envelope.',
    );
  }

  return body.applications;
}

export async function reviewNgoApplication(
  address: string,
  signMessage: WalletSignMessage,
  id: string,
  action: 'approve' | 'reject',
  reviewNote?: string,
): Promise<NgoApplication> {
  const path = `/ngo-applications/${id}/${action}`;
  const res = await adminFetch('POST', path, address, signMessage, {
    reviewNote: reviewNote?.trim() || undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to ${action} application: ${res.status}`);
  }
  return res.json();
}
