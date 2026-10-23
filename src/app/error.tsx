'use client';

import { RouteError } from '@/components/common/RouteError';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

// Sits outside the `(main)` route group, so unlike every other error.tsx
// in the app, it can't rely on that group's layout for the header/footer —
// it needs its own.
export default function ErrorPage(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <Header />
      <RouteError {...props} />
      <Footer />
    </>
  );
}
