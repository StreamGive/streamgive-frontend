import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { ToastProvider } from '@/components/toast/ToastProvider';
import { WalletProvider } from '@/components/wallet/WalletProvider';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const DESCRIPTION = 'Recurring, streaming donations for verified NGOs on Stellar.';

export const metadata: Metadata = {
  title: {
    default: 'StreamGive',
    // Child routes set just their own segment (e.g. "Explore NGOs") and
    // get this composed automatically, rather than repeating "StreamGive"
    // in every page's own metadata.
    template: '%s — StreamGive',
  },
  description: DESCRIPTION,
  openGraph: {
    title: 'StreamGive',
    description: DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'StreamGive',
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>
          <WalletProvider>{children}</WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
