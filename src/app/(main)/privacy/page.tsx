import type { Metadata } from 'next';

// A placeholder, not a published policy — see the page body. Kept out of
// search results so it can't be mistaken for StreamGive's actual privacy
// policy once one exists.
export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main id="main" className="px-6 py-16 sm:px-12">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <div className="mt-4 max-w-2xl space-y-4 text-gray-600 dark:text-gray-400">
        <p>StreamGive hasn&apos;t published a privacy policy yet.</p>
        <p>
          In the meantime, what we actually hold: the frontend keeps no server-side session —
          wallet addresses, NGO applications and transaction records are handled by{' '}
          <code className="rounded bg-gray-100 px-1 text-sm dark:bg-gray-800">
            streamgive-backend
          </code>
          , and donation/withdrawal activity is itself public on the Stellar network, independent
          of this site.
        </p>
        <p>
          Questions about data handling?{' '}
          <a
            href="https://github.com/streamgive/streamgive-frontend/issues/new"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-black dark:hover:text-white"
          >
            Open an issue on GitHub
            {' '}<span className="sr-only">(opens in a new tab)</span>
          </a>
          .
        </p>
      </div>
    </main>
  );
}
