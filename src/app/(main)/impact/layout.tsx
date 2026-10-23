import type { Metadata } from 'next';

// The page itself is a Client Component (it polls for live updates), and
// Next.js only allows metadata exports from Server Component files —
// hence a segment layout just for this.
export const metadata: Metadata = {
  title: 'Platform Impact',
  description: 'Live, platform-wide totals for StreamGive donations on Stellar.',
};

export default function ImpactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
