'use client';

import { RouteError } from '@/components/common/RouteError';

export default function NgoAdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} subject="The NGO admin page" />;
}
