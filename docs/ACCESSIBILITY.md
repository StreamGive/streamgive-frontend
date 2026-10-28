# Accessibility patterns

This document covers the accessibility patterns, conventions, and implementations used throughout `streamgive-frontend`. Contributors adding or editing interactive UI should follow these patterns to maintain consistency across the app.

For the pre-PR review checklist, see the [Accessibility checklist in CONTRIBUTING.md](../CONTRIBUTING.md#accessibility-checklist).

---

## Focus rings & interactive states

Keyboard navigation must always produce a clear, high-contrast visual indicator without adding distracting outlines on pointer clicks.

### Standard focus ring classes

The canonical focus ring token pair in this codebase uses Tailwind's `focus-visible:` variant with `teal-600` (light mode) and `teal-400` (dark mode):

```tsx
className =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400';
```

Apply this class combination to all interactive controls:

- **Buttons**: primary, secondary, and ghost buttons (see `src/components/wallet/ConnectWalletButton.tsx`)
- **Inputs & textareas**: text inputs and search bars (see `src/components/donate/CreateStreamForm.tsx`)
- **Selects**: duration and token dropdowns (see `src/components/dashboard/StreamControls.tsx`)
- **Tabs**: tablist triggers (see `src/app/(main)/dashboard/page.tsx` and `src/app/(main)/platform-admin/page.tsx`)
- **Links**: styled action links or card wrappers where default browser outlines are suppressed

### Inverted / dark overlay surfaces

When a focusable control sits on a solid dark background (such as the toast container in `src/components/toast/ToastProvider.tsx`), use a white ring to ensure sufficient contrast:

```tsx
className = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
```

### Guidelines for focus styling

- **Never suppress outlines with `outline-none` alone.** Always pair `focus-visible:outline-none` with an explicit `focus-visible:ring-2` replacement.
- **Use `focus-visible:` rather than `focus:`.** `focus-visible:` applies outlines only during keyboard navigation or programmatic focus moves, keeping mouse and touch clicks clean while preserving accessibility.

---

## Modal dialogs & focus trapping

Modals in this codebase (e.g. `src/components/streams/StreamDetailsModal.tsx` and the confirmation step in `src/components/donate/CreateStreamForm.tsx`) follow a consistent pattern without requiring an external heavy UI library.

### Key requirements

1. **Overlay & dialog semantics**:
   - The outer backdrop is fixed (`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4`) and clicking it invokes `onClose`.
   - The inner dialog container specifies `role="dialog"`, `aria-modal="true"`, and points `aria-labelledby` to the modal title heading ID.
   - The inner container catches click events with `onClick={(e) => e.stopPropagation()}` so clicking dialog content does not close the modal.
2. **Scroll locking**:
   - When the modal mounts, set `document.body.style.overflow = 'hidden'`.
   - Restore the previous `overflow` value in the cleanup function.
3. **Initial focus & focus restoration**:
   - Store the previously focused element (`document.activeElement as HTMLElement | null`) before or upon mount.
   - Move focus into the dialog on mount (e.g. onto the close button or primary confirmation button via a `ref`).
   - On unmount or close, restore focus back to the recorded trigger element if it is still valid and focusable.
4. **Escape key dismissal**:
   - Listen for `keydown` with `event.key === 'Escape'` to invoke `onClose`. Remove the event listener on unmount.
5. **Keyboard focus trap (Tab / Shift+Tab)**:
   - Query all focusable elements inside the dialog ref:
     `'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'`
   - Filter out elements with `disabled` or `aria-hidden="true"`.
   - When pressing `Tab` from the last focusable element, wrap focus back to the first element with `event.preventDefault()`.
   - When pressing `Shift + Tab` from the first focusable element, wrap focus to the last element with `event.preventDefault()`.

### Reference implementation

```tsx
export function ModalExample({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 1. Lock body scrolling
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // 2. Focus close button on mount and restore focus on unmount
  useEffect(() => {
    const triggerElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    return () => {
      if (triggerElement && typeof triggerElement.focus === 'function') {
        triggerElement.focus();
      }
    };
  }, []);

  // 3. Escape key + Tab wrapping
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        if (!dialogRef.current) return;

        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
        );
        const focusable = Array.from(focusableElements).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
        );

        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold">
            Modal Title
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            &times;
          </button>
        </div>
        <div className="mt-4">{/* Dialog content */}</div>
      </div>
    </div>
  );
}
```

---

## Live regions & dynamic status announcements

When asynchronous operations change the UI without a full page reload (e.g. form submissions, transaction status updates, clipboard copies, toasts), assistive technology must be informed through ARIA live regions.

### Choosing between `role="status"` and `role="alert"`

| Role            | `aria-live` default | Urgency                                      | Usage in StreamGive                                                                                                                                     |
| --------------- | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role="status"` | `polite`            | Non-blocking, reads when speech queue clears | Transaction confirmations, loading indicators, clipboard copy feedback, success toasts (`ToastProvider`), idle progress wrappers (`StreamControls`)     |
| `role="alert"`  | `assertive`         | Immediate, interrupts current speech         | Error messages requiring immediate correction, contract call failures, wrong-network banners (`EnvironmentBanner`, `ConnectWalletButton`), error toasts |

### Live container mounting rules

Screen readers detect changes _within_ an existing live region. If an element with `aria-live` or `role="status"` is added to the DOM at the exact same moment its text content appears, many screen readers will miss the announcement.

- **Unconditional container mounting**: In `src/components/toast/ToastProvider.tsx`, the `<div aria-live="polite" aria-atomic="false">` host container is mounted permanently from initial page render. New toasts appear as children inside this mounted tree, reliably triggering screen reader announcements.
- **Dedicated screen-reader announcements**: For discrete actions like copying an address or link (`src/components/common/CopyAddressButton.tsx`), provide a visually hidden announcement alongside the button:

```tsx
<span role="status" aria-live="polite" className="sr-only">
  {status === 'copied' && 'Address copied to clipboard.'}
  {status === 'error' && 'Could not copy the address. Copy it manually instead.'}
</span>
```

### Auto-dismiss and WCAG 2.2.1 (Timing Adjustable)

Toast notifications (`ToastProvider.tsx`) display for 5 seconds by default. Because error messages and transaction hashes take longer to read, auto-dismiss timers must pause on user interaction:

- Listen to both `onMouseEnter` / `onMouseLeave` (mouse hover) and `onFocus` / `onBlur` (keyboard focus).
- Clear the dismiss timer while hovered or focused, and restart the timer when focus/hover leaves.

---

## Focus management across mode switches & disabled controls

When multi-step or inline workflows switch modes (such as `src/components/dashboard/StreamControls.tsx` switching between idle, top up, modify rate, and cancel confirmation), DOM subtrees mount and unmount. This risks dropping keyboard focus to `<body>`.

### Handling mode switches

1. **Entering a mode**: When a user clicks a button to enter an inline mode, programmatically move focus to the first interactive field (e.g. the amount `<input>` or duration `<select>`).
2. **Backing out**: When the user clicks "Back" or "Never mind", return focus to the trigger button that originally opened the mode.
3. **The disabled trigger fallback**:
   - When a user submits an action, the UI returns to the idle mode while the action is pending.
   - The trigger button is now disabled (e.g. `pending === 'topUp'`).
   - **Crucial catch**: Disabled buttons cannot hold focus. If you call `.focus()` on a disabled button, the browser silently resets focus to `<body>`.
   - **Solution**: Target a status container with `tabIndex={-1}` and `role="status"`:

```tsx
// StreamControls.tsx pattern
if (trigger && !trigger.disabled) {
  trigger.focus();
} else {
  idleContainerRef.current?.focus();
}
```

```tsx
<div
  ref={idleContainerRef}
  role="status"
  aria-live="polite"
  tabIndex={-1}
  className="flex flex-wrap items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-400"
>
  {/* Status copy and action buttons */}
</div>
```

---

## Accessible names & semantic HTML

- **Native elements first**: Always use `<button>` for actions and `<a>` (or Next.js `<Link>`) for navigation. Do not use `<div onClick>`.
- **Icon-only buttons**: Any button displaying only an icon or SVG must have a descriptive `aria-label` (e.g. `aria-label="Close"`, `aria-label="Copy address <address>"`).
- **Decorative icons**: Icons accompanying visible text must be hidden from screen readers using `aria-hidden="true"`.
- **Form labels**: Every `<input>`, `<textarea>`, and `<select>` must have an associated `<label>` (via `htmlFor` matching the control's `id`) or an `aria-label` attribute if visually omitted.
- **Disclosure controls**: Dropdowns and collapsible menus must declare `aria-expanded={isOpen}` and point `aria-controls="<target-id>"` at the expandable container (see `src/components/layout/Header.tsx`).

---

## Color contrast & motion preferences

### Contrast (WCAG 2.1 AA)

- Normal body text must achieve at least 4.5:1 contrast against its background.
- Large text (18pt or 14pt bold) and interactive components/borders must achieve at least 3:1.
- Note on status badges and toasts:
  - In `ToastProvider.tsx`, `bg-green-700` is used for success toasts rather than `bg-green-600` because `bg-green-600` on white text yields ~3.4:1 (violating AA), while `bg-green-700` provides compliant 4.5:1+ contrast.
  - Review [docs/THEMING.md](./THEMING.md) for approved color token pairings in light and dark modes.

### Motion sensitivity (`prefers-reduced-motion`)

- Animations must respect the user's OS reduced-motion preferences.
- Global keyframes (`globals.css`): `.route-progress-bar` disables sweeping animations under `@media (prefers-reduced-motion: reduce)`.
- Tailwind utilities: Use `motion-reduce:animate-none` on loading skeletons and pulse animations (e.g. `src/app/(main)/impact/page.tsx`).

---

## Verifying accessibility locally

1. **Automated Playwright axe scans**:
   ```bash
   npm run test:a11y
   ```
   Runs axe-core checks across key public pages in both light and dark modes. Violations fail CI.
2. **Keyboard verification**:
   - Tab through all interactive elements to confirm logical tab order and visible focus rings.
   - Confirm Escape closes open modals and menus.
   - Verify focus returns to the opening trigger when dialogs close.
3. **Unit & component tests**:
   - When writing component tests in Vitest, assert accessible roles (`getByRole`), labels (`getByLabelText`), focus movement (`toHaveFocus()`), and live region updates.
