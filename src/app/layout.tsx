import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';

import { EnvironmentBanner } from '@/components/common/EnvironmentBanner';
import { RouteProgressBar } from '@/components/common/RouteProgressBar';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

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
    // suppressHydrationWarning: THEME_INIT_SCRIPT adds a `dark`/`light`
    // class here before React hydrates, which never matches the
    // server-rendered markup (the server doesn't know the client's
    // preference) — that mismatch is expected and this is the documented
    // way to silence the resulting warning without disabling it app-wide.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must run synchronously, before paint, to avoid a flash of the
            wrong theme — see THEME_INIT_SCRIPT's own comment. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100`}
      >
        <EnvironmentBanner />
        {/* RouteProgressBar reads useSearchParams(), which requires a
            Suspense boundary — see NgoExplorer's own use of this pattern. */}
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <ToastProvider>
          <WalletProvider>{children}</WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
