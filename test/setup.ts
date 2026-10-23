import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not implement matchMedia, which the theme toggle uses both
// to read the system preference and to subscribe to preference changes.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
}

// Testing Library only auto-registers its cleanup when Vitest runs with
// `globals: true`, which this project doesn't. Without it, every render in
// a file stacks up in the same document and the second test in any file
// starts failing with "Found multiple elements with the role ...".
afterEach(cleanup);
