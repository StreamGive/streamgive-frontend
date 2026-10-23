import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Don't advertise the framework/version in an X-Powered-By header.
  poweredByHeader: false,

  // Self-contained server in .next/standalone, so the production Dockerfile
  // can ship a runtime image without the whole node_modules tree.
  //
  // Skipped on Vercel, which builds and runs the app itself and expects the
  // default output layout — standalone omits the build-trace manifests it
  // looks for, and the build dies on a missing next-server.js.nft.json.
  // VERCEL is set by their build environment.
  output: process.env.VERCEL ? undefined : 'standalone',
};

export default withNextIntl(nextConfig);
