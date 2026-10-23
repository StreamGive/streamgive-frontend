import { describe, expect, it, vi } from 'vitest';

import { loadPlatformImpact } from '@/lib/impact';

import { StatsStrip } from './StatsStrip';

vi.mock('@/lib/impact', () => ({
  loadPlatformImpact: vi.fn(),
}));

describe('StatsStrip', () => {
  it('renders null when the API is unreachable, instead of zeros or an error', async () => {
    vi.mocked(loadPlatformImpact).mockRejectedValue(new Error('backend unreachable'));

    await expect(StatsStrip()).resolves.toBeNull();
  });
});
