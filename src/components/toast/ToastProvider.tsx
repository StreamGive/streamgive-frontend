'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'info';
export type ToastAction = { label: string; url: string };
export type Toast = {
  id: number;
  type: ToastType;
  message: string;
  action?: ToastAction;
  /** How many times this exact type+message has fired in a row, collapsed
   * into this one entry instead of piling up duplicates. */
  count: number;
};

export type ToastContextValue = {
  showToast: (type: ToastType, message: string, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;
const TOAST_DURATION_MS = 5000;
// A burst of repeated failures must not fill the screen with identical
// toasts forever — the oldest is dropped to make room once the list is
// this full.
const MAX_VISIBLE_TOASTS = 5;

// bg-green-600 on white text is ~3.4:1 — under AA's 4.5:1 for normal text —
// so success uses a darker shade instead of a dark: override, since these
// are solid floating boxes rather than page background/text pairs.
const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-green-700 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-900 text-white',
};

export function ToastProvider({
  children,
  hideHost = false,
}: {
  children: ReactNode;
  /** Suppresses the floating toast list while still providing `useToast()`
   * context to `children` — used on the embed widget (issue #214), where a
   * fixed-position overlay inside a partner's small iframe looks broken
   * rather than helpful. */
  hideHost?: boolean;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Mirrors `toasts` synchronously (state updates don't land until the next
  // render), so showToast can look up "is this a duplicate of what's on
  // screen right now" without taking a dependency on `toasts` itself —
  // that dependency would change showToast's identity on every toast
  // shown/dismissed, and it's passed as a useEffect dependency elsewhere
  // (e.g. the contract clients), where that churn would force needless
  // reconnects.
  const toastsRef = useRef<Toast[]>([]);

  // One announced string per politeness level, rendered into a region
  // that's in the DOM from first render. A live region usually only
  // reliably announces content that changes *inside* it after it already
  // exists — inserting a brand-new element that already carries
  // role="status"/aria-live is the pattern assistive tech often misses.
  const [politeAnnouncement, setPoliteAnnouncement] = useState('');
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState('');

  // Per-toast auto-dismiss timers, so hover/focus can pause and later
  // restart one without touching the others (WCAG 2.2.1 Timing Adjustable —
  // error messages in particular can be too long to read in 5s).
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const setToastsAndRef = useCallback((next: Toast[]) => {
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      clearTimer(id);
      setToastsAndRef(toastsRef.current.filter((toast) => toast.id !== id));
    },
    [clearTimer, setToastsAndRef],
  );

  const scheduleDismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), TOAST_DURATION_MS),
      );
    },
    [clearTimer, dismissToast],
  );

  const pauseDismiss = useCallback(
    (id: number) => {
      clearTimer(id);
    },
    [clearTimer],
  );

  const announce = useCallback((type: ToastType, text: string) => {
    if (type === 'error') {
      setAssertiveAnnouncement(text);
    } else {
      setPoliteAnnouncement(text);
    }
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, action?: ToastAction) => {
      const current = toastsRef.current;
      const duplicateIndex = current.findIndex(
        (toast) => toast.type === type && toast.message === message,
      );

      if (duplicateIndex !== -1) {
        const existing = current[duplicateIndex];
        const updated: Toast = { ...existing, count: existing.count + 1 };
        const next = current.slice();
        next[duplicateIndex] = updated;
        setToastsAndRef(next);
        scheduleDismiss(existing.id);
        announce(type, `${message} (×${updated.count})`);
        return;
      }

      const id = nextId++;
      let next = [...current, { id, type, message, action, count: 1 }];
      if (next.length > MAX_VISIBLE_TOASTS) {
        const [oldest, ...rest] = next;
        clearTimer(oldest.id);
        next = rest;
      }
      setToastsAndRef(next);
      scheduleDismiss(id);
      announce(type, message);
    },
    [announce, clearTimer, scheduleDismiss, setToastsAndRef],
  );

  // Timers must not outlive the provider — nothing is left to call
  // dismissToast once this unmounts.
  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {!hideHost && (
        <>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {politeAnnouncement}
          </div>
          <div aria-live="assertive" aria-atomic="true" className="sr-only">
            {assertiveAnnouncement}
          </div>

          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                // Belt-and-suspenders alongside the two persistent regions
                // above: harmless if some AT also picks these up directly,
                // and keeps each toast's urgency conveyed even by tooling
                // that reads role semantics rather than aria-live mutations.
                role={toast.type === 'error' ? 'alert' : 'status'}
                onMouseEnter={() => pauseDismiss(toast.id)}
                onMouseLeave={() => scheduleDismiss(toast.id)}
                onFocus={() => pauseDismiss(toast.id)}
                onBlur={() => scheduleDismiss(toast.id)}
                className={`flex max-w-sm items-start gap-3 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${TOAST_STYLES[toast.type]}`}
              >
                <div className="flex-1">
                  <p>
                    {toast.message}
                    {toast.count > 1 ? ` (×${toast.count})` : ''}
                  </p>
                  {toast.action && (
                    <a
                      href={toast.action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
                    >
                      {toast.action.label}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded-sm text-base leading-none opacity-80 hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
