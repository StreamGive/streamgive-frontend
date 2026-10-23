const STAT_COUNT = 3;

/** Suspense fallback for StatsStrip, shown while its stats request is in
 * flight — same shape (a bordered strip of label/value pairs) so nothing
 * jumps when the real numbers replace it. */
export function StatsStripSkeleton() {
  return (
    <section
      role="status"
      className="border-y border-gray-100 px-6 py-12 sm:px-12"
    >
      <span className="sr-only">Loading platform stats…</span>
      <dl className="mx-auto grid max-w-4xl animate-pulse grid-cols-1 gap-8 text-center motion-reduce:animate-none sm:grid-cols-3">
        {Array.from({ length: STAT_COUNT }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </dl>
    </section>
  );
}
