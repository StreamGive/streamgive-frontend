import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { API_URL } from '@/lib/config';

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Only the origins the app (and the wallet kit it embeds) actually talks to.
// The API and RPC origins come from env so a non-default deployment isn't
// blocked by its own CSP.
const CONNECT_SOURCES = [
  "'self'",
  originOf(API_URL),
  originOf(SOROBAN_RPC_URL),
  // Horizon lookups made by the Stellar SDK / wallet kit.
  'https://*.stellar.org',
  // WalletConnect relay used by the kit's WalletConnect module.
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'wss://*.walletconnect.com',
  'wss://*.walletconnect.org',
].filter((source): source is string => source !== null);

/**
 * Builds the Content-Security-Policy for a request.
 *
 * script-src still allows 'unsafe-inline': Next.js emits inline bootstrap
 * scripts and layout.tsx has an inline theme-init script. Moving to
 * per-request nonces would make every page dynamic, so that is left as a
 * follow-up; the rest of the policy (frame-ancestors, connect-src,
 * object-src, base-uri, form-action) still limits what injected script can
 * do.
 */
function contentSecurityPolicy(isEmbed: boolean): string {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (process.env.NODE_ENV !== 'production') {
    // React Refresh needs eval in development only.
    scriptSources.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${CONNECT_SOURCES.join(' ')}`,
    "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // /embed/* is deliberately meant to be iframed on third-party (NGO)
  // sites (see src/app/embed) — every other route blocks framing outright.
  if (!isEmbed) {
    directives.push("frame-ancestors 'none'");
  }

  return directives.join('; ');
}

// Everything the app doesn't use is switched off. usb/hid/bluetooth stay
// available to this origin because the wallet kit's hardware-wallet
// (Ledger/Trezor) modules need them.
const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=(self)',
  'hid=(self)',
  'bluetooth=(self)',
].join(', ');

/**
 * Plain conditional logic rather than next.config.ts's headers()
 * path-matching: that uses path-to-regexp syntax, and reliably expressing
 * "every route except /embed" in it isn't something I could verify
 * without running it. This is easier to read and to get right.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const isEmbed = request.nextUrl.pathname.startsWith('/embed');

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(isEmbed));
  // Two years, as required for HSTS preload eligibility; browsers ignore the
  // header over plain http, so local development is unaffected.
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains',
  );
  response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);

  if (!isEmbed) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  return response;
}

export const config = {
  matcher: '/:path*',
};
