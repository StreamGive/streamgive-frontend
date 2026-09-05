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
