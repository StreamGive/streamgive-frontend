const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

/** Returns null for a genuine 404 (distinct from a thrown network/server
 * error) so the caller can render "not found" instead of an error state. */
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

/** Called client-side (it depends on the connected wallet address, which
 * only exists in the browser), so no Next.js server-fetch caching options. */
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
