import type { Metadata } from 'next';

// Wallet-gated NGO management view — not indexable content.
export const metadata: Metadata = {
  title: 'NGO Admin',
  robots: { index: false, follow: false },
};

export default function NgoAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
