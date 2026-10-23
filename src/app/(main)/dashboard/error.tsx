'use client';

import { RouteError } from '@/components/common/RouteError';

export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} subject="Your dashboard" />;
}
