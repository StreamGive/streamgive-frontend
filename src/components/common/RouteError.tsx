'use client';

import { useEffect } from 'react';

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Short sentence describing what failed to load, e.g. "your dashboard". */
  subject?: string;
};

/** Shared body of every route-level `error.tsx`: logs the error, offers a
 * Try again action and shows the digest so a failure can be matched to the
 * server logs. The surrounding chrome comes from the route group layout,
 * which stays mounted while this renders in its place — except for the
 * root `error.tsx`, which wraps this itself since it sits outside that
 * layout and has to supply its own. */
export function RouteError({ error, reset, subject = 'This page' }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-[60vh] items-center justify-center px-6 py-20 text-center sm:px-12"
    >
      <div className="max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-400">
          Something went wrong
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          We hit an unexpected issue.
        </h1>
        <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
          {subject} couldn’t be loaded right now. Please try again, or keep exploring StreamGive
          using the links above.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Error reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 inline-flex rounded-md bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
