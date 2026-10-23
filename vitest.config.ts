import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // The e2e/ specs are Playwright's, not Vitest's — they are run
    // separately by `npx playwright test`. Without this, Vitest picks them
    // up and each one dies on "Playwright Test did not expect
    // test.describe() to be called here".
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      // Prints the per-file table plus an overall summary to the terminal;
      // nothing written to disk unless `npm run test:coverage` is passed
      // its own --reporter flags.
      reporter: ['text'],
      exclude: [...coverageConfigDefaults.exclude, 'e2e/**', 'test/**'],
    },
  },
  resolve: {
    // Mirrors tsconfig.json's baseUrl/paths — Vitest doesn't read those
    // automatically without an extra plugin, so it's duplicated here by hand.
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
});
