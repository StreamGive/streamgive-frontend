/** Placeholder matching the shape of a rendered NGO card, shown while
 * getNgos() is in flight on the explorer page. */
export function NgoCardSkeleton() {
  return (
    <li className="animate-pulse rounded-lg border border-gray-200 p-6">
      <div className="h-5 w-2/3 rounded bg-gray-200" />

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <dt className="h-3 w-10 rounded bg-gray-200" />
            <dd className="mt-2 h-4 w-8 rounded bg-gray-200" />
          </div>
        ))}
      </dl>

      <div className="mt-4 h-4 w-24 rounded bg-gray-200" />
    </li>
  );
}
