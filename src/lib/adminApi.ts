import type { WalletSignMessage } from '@/components/wallet/WalletProvider';

import type { NgoApplication } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
  const timestamp = Date.now().toString();
  const payload = `${method}:${path}:${timestamp}`;
  const signature = await signMessage(payload);

  return fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-admin-address': address,
      'x-admin-signature': signature,
      'x-admin-timestamp': timestamp,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

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
  return res.json();
}

export async function reviewNgoApplication(
  address: string,
  signMessage: WalletSignMessage,
  id: string,
  action: 'approve' | 'reject',
): Promise<NgoApplication> {
  const path = `/ngo-applications/${id}/${action}`;
  const res = await adminFetch('POST', path, address, signMessage, {});
  if (!res.ok) {
    throw new Error(`Failed to ${action} application: ${res.status}`);
  }
  return res.json();
}
