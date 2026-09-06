import type { Metadata } from 'next';

// Wallet-gated, personal to whoever connects — there's nothing here worth
// (or appropriate for) a search engine to index.
export const metadata: Metadata = {
  title: 'Your Donations',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
