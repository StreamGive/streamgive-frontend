import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply as an NGO',
  description: 'Apply to receive recurring, streaming donations on StreamGive.',
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
