'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * A top-of-page progress indicator for route transitions.
 *
 * The App Router gives no direct "navigation started" event — `usePathname`/
 * `useSearchParams` only change once the new route has actually resolved, by
 * which point a transition into a slow server-rendered page has already
 * happened. So this also listens for clicks on same-document, same-origin
 * links (the common case: an in-app `<Link>` or `<a href="/...">`) and starts
 * the bar immediately on click, well before the URL changes — that's the
 * "feels unresponsive during the fetch" gap this issue is about closing.
 *
 * Finishes (and hides) once `pathname`/`searchParams` reflect the new route,
 * which is the App Router's own signal that the transition completed.
 */
// A transition that's still running after this long is treated as stuck —
// redirected somewhere this listener couldn't see, errored out without a
// URL change, or otherwise never going to resolve — rather than left to
// show forever.
const MAX_DURATION_MS = 8000;

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  // Tracks the pathname+search the bar started a transition away from, so a
  // change back to the *same* route (e.g. a query-string-only update the
  // click listener never saw) doesn't leave the bar stuck showing forever.
  const startedFrom = useRef<string | null>(null);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingTimeout() {
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
  }

  useEffect(() => {
    const current = `${pathname}?${searchParams.toString()}`;
    if (startedFrom.current !== null && startedFrom.current !== current) {
      clearPendingTimeout();
      setActive(false);
      startedFrom.current = null;
    }
  }, [pathname, searchParams]);

  // Belt-and-suspenders cleanup on unmount — nothing else references this
  // timeout once the component is gone.
  useEffect(() => clearPendingTimeout, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Modified clicks (open in new tab, etc.) never navigate this document.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element).closest('a');
      if (!anchor) return;
      // `target="_blank"`/download links don't navigate this document either.
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}`;
      const target = `${url.pathname}${url.search}`;
      if (target === current) return;

      startedFrom.current = current;
      setActive(true);

      clearPendingTimeout();
      timeoutId.current = setTimeout(() => {
        setActive(false);
        startedFrom.current = null;
        timeoutId.current = null;
      }, MAX_DURATION_MS);
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-label="Loading page"
      className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-transparent"
    >
      <div className="route-progress-bar h-full bg-blue-600 dark:bg-blue-400" />
    </div>
  );
}
