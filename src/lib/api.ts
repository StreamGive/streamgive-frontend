const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Thrown by API calls that need callers to branch on the HTTP status
 * (e.g. 409 conflict vs. other failures) rather than just knowing a
 * request failed. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Ngo = {
  id: string;
  ownerAddress: string;
  name: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Fetches the list of all NGOs.
 *
 * Server-side fetch cached for 30s via Next.js `revalidate`.
 *
 * @throws {Error} if the response is not ok.
 */
export async function getNgos(): Promise<Ngo[]> {
  const res = await fetch(`${API_URL}/ngos`, { next: { revalidate: 30 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch NGOs: ${res.status}`);
  }
  return res.json();
}

export type NgoProfile = Ngo & {
  stats: {
    totalCommitted: string;
    totalWithdrawn: string;
    activeStreamCount: number;
    donorCount: number;
  };
};

/**
 * Fetches a single NGO's profile, including donation stats.
 *
 * Server-side fetch cached for 30s via Next.js `revalidate`.
 *
 * @param id - NGO id.
 * @returns The profile, or `null` for a genuine 404 (distinct from a
 * thrown network/server error) so the caller can render "not found"
 * instead of an error state.
 * @throws {Error} if the response is not ok and not a 404.
 */
export async function getNgo(id: string): Promise<NgoProfile | null> {
  const res = await fetch(`${API_URL}/ngos/${id}`, { next: { revalidate: 30 } });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch NGO ${id}: ${res.status}`);
  }
  return res.json();
}

export type Stream = {
  id: string;
  onChainId: string;
  tokenAddress: string;
  rate: string;
  balance: string;
  withdrawn: string;
  status: 'ACTIVE' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  donor: { address: string };
  ngo: { id: string; name: string; ownerAddress: string };
};

/**
 * Fetches streams matching the given filter. Pass `donor` and/or `ngo` to
 * narrow results; an empty filter returns all streams.
 *
 * Called client-side (it depends on the connected wallet address, which
 * only exists in the browser), so no Next.js server-fetch caching options.
 *
 * @throws {Error} if the response is not ok.
 */
export async function getStreams(filter: { donor?: string; ngo?: string }): Promise<Stream[]> {
  const params = new URLSearchParams();
  if (filter.donor) params.set('donor', filter.donor);
  if (filter.ngo) params.set('ngo', filter.ngo);

  const res = await fetch(`${API_URL}/streams?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch streams: ${res.status}`);
  }
  return res.json();
}

export type NgoApplicationInput = {
  ownerAddress: string;
  name: string;
  description: string;
  contactEmail: string;
  website?: string;
  country?: string;
};

export type NgoApplication = {
  id: string;
  ownerAddress: string;
  name: string;
  description: string;
  website: string | null;
  contactEmail: string;
  country: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Submits a new NGO application for review.
 *
 * @throws {ApiError} with status 409 if an application from this
 * `ownerAddress` is already pending review, or with the response's status
 * for any other non-ok response.
 */
export async function submitNgoApplication(input: NgoApplicationInput): Promise<NgoApplication> {
  const res = await fetch(`${API_URL}/ngo-applications`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (res.status === 409) {
    throw new ApiError('An application from this address is already pending review.', 409);
  }
  if (!res.ok) {
    throw new ApiError('Failed to submit application.', res.status);
  }
  return res.json();
}
