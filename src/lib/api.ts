const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
