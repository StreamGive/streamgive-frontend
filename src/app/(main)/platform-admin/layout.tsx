import type { Metadata } from 'next';

// Single-admin-address-gated review panel — not indexable content.
export const metadata: Metadata = {
  title: 'Platform Admin',
  robots: { index: false, follow: false },
};

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
