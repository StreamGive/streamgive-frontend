import type { Metadata } from 'next';

// A placeholder, not a published policy — see the page body. Kept out of
// search results so it can't be mistaken for StreamGive's actual terms
// once they exist.
export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main id="main" className="px-6 py-16 sm:px-12">
      <h1 className="text-2xl font-bold">Terms of Service</h1>
      <div className="mt-4 max-w-2xl space-y-4 text-gray-600 dark:text-gray-400">
        <p>StreamGive hasn&apos;t published formal terms of service yet.</p>
        <p>
          StreamGive is open-source software (see the{' '}
          <a
            href="https://github.com/streamgive"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-black dark:hover:text-white"
          >
            GitHub organization
            {' '}<span className="sr-only">(opens in a new tab)</span>
          </a>
          ) that lets donors stream funds to verified NGOs on the Stellar network. Every
          donation, stream and withdrawal it facilitates is an on-chain transaction you sign
          yourself — the site is a client for the Stellar network, not a custodian of your funds.
        </p>
        <p>
          Questions in the meantime?{' '}
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
