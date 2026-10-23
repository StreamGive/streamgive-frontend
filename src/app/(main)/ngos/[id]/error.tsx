'use client';

import { RouteError } from '@/components/common/RouteError';

export default function NgoProfileError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} subject="This NGO profile" />;
}
