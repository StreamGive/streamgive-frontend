import Link from 'next/link';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 max-w-md text-gray-600 dark:text-gray-400">
          We couldn&apos;t find what you were looking for. It may have been moved or the link may
          be out of date.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Go home
          </Link>
          <Link
            href="/ngos"
            className="rounded-md border border-gray-300 px-6 py-3 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Explore NGOs
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
