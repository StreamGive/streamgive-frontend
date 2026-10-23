'use client';

import { RouteError } from '@/components/common/RouteError';

export default function PlatformAdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} subject="The platform admin page" />;
}
