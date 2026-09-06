import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bundles only what's needed to run into .next/standalone, instead of
  // shipping the full node_modules — what the production Dockerfile uses.
  output: 'standalone',
};

export default nextConfig;
