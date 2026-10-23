const ROW_COUNT = 4;

/** Shared body of every route-level `loading.tsx`: a pulsing placeholder,
 * announced to screen readers as a busy region. The surrounding chrome
 * comes from the route group layout, which stays mounted while this
 * renders in its place. */
export function RouteLoading({ title }: { title?: string }) {
  return (
    <main id="main" className="px-6 py-16 sm:px-12" aria-busy="true">
      <div role="status">
        <span className="sr-only">Loading…</span>
        {title ? (
          <h1 className="text-2xl font-bold">{title}</h1>
        ) : (
          <div className="h-8 w-1/3 animate-pulse rounded bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" />
        )}
      </div>

      <div className="mt-8 space-y-4" aria-hidden="true">
        {Array.from({ length: ROW_COUNT }, (_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-gray-200 bg-gray-100 motion-reduce:animate-none dark:border-gray-800 dark:bg-gray-900"
          />
        ))}
      </div>
    </main>
  );
}
