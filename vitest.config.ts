import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    // Mirrors tsconfig.json's baseUrl/paths — Vitest doesn't read those
    // automatically without an extra plugin, so it's duplicated here by hand.
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
});
