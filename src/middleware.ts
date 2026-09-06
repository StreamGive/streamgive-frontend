import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Plain conditional logic rather than next.config.ts's headers()
 * path-matching: that uses path-to-regexp syntax, and reliably expressing
 * "every route except /embed" in it isn't something I could verify
 * without running it. This is easier to read and to get right.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // /embed/* is deliberately meant to be iframed on third-party (NGO)
  // sites (see src/app/embed) — every other route blocks framing outright.
  if (!request.nextUrl.pathname.startsWith('/embed')) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  return response;
}

export const config = {
  matcher: '/:path*',
};
