import Link from 'next/link';

/** Visually-hidden suffix for a link's accessible name, so screen reader
 * users get the same warning sighted users get from the external-link
 * affordance before they're taken out of the app. No leading space in the
 * span itself — the accessible-name computation trims it, so the space has
 * to be its own text node (the {' '} at each call site) to survive. */
function NewTabCue() {
  return <span className="sr-only">(opens in a new tab)</span>;
}

export function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-8 text-sm text-gray-500 sm:px-12 dark:border-gray-800 dark:text-gray-400">
      <p>StreamGive — open source, built on Stellar.</p>
      <div className="mt-2 flex flex-wrap gap-4">
        <a
          href="https://github.com/streamgive"
          className="hover:text-black dark:hover:text-white"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
          {' '}<NewTabCue />
        </a>
        <a
          href="https://github.com/streamgive/streamgive-docs"
          className="hover:text-black dark:hover:text-white"
          target="_blank"
          rel="noreferrer"
        >
          Docs
          {' '}<NewTabCue />
        </a>
        <a
          href="https://github.com/streamgive/streamgive-frontend/issues/new"
          className="hover:text-black dark:hover:text-white"
          target="_blank"
          rel="noreferrer"
        >
          Contact
          {' '}<NewTabCue />
        </a>
        <Link href="/privacy" className="hover:text-black dark:hover:text-white">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-black dark:hover:text-white">
          Terms
        </Link>
      </div>
    </footer>
  );
}
