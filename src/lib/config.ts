/** Base URL of the `streamgive-backend` API every fetch call targets. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Server-render fallback for the app's own origin.
 *
 * In the browser the real origin is read from `window` instead (see
 * EmbedSnippet), so this value only ever appears in server-rendered HTML
 * before hydration. Deployments do not need to set NEXT_PUBLIC_APP_URL.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

/**
 * The wallet address allowed into /platform-admin. Not a secret — the
 * backend independently enforces this on every admin request — just used
 * here to decide whether the nav link is worth showing.
 */
export const PLATFORM_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? '';
