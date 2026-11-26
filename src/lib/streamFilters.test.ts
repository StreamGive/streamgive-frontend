import { describe, expect, it } from 'vitest';

import type { Stream } from '@/lib/api';

import { filterStreams } from './streamFilters';

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 'stream-1',
    onChainId: '1',
    tokenAddress: 'CTOKEN',
    rate: '10',
    balance: '1000',
    withdrawn: '0',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    donor: { address: 'G123' },
    ngo: { id: 'ngo-1', name: 'Test NGO', ownerAddress: 'GNGO' },
    ...overrides,
  };
}

describe('filterStreams', () => {
  it('keeps only streams for the given token', () => {
    const streams = [
      makeStream({ id: 'a', tokenAddress: 'CNATIVE' }),
      makeStream({ id: 'b', tokenAddress: 'CUSDC' }),
      makeStream({ id: 'c', tokenAddress: 'CNATIVE' }),
    ];

    expect(filterStreams(streams, 'ALL', '', 'CNATIVE').map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('treats an empty token as all tokens', () => {
    const streams = [
      makeStream({ id: 'a', tokenAddress: 'CNATIVE' }),
      makeStream({ id: 'b', tokenAddress: 'CUSDC' }),
    ];

    expect(filterStreams(streams, 'ALL', '', '')).toHaveLength(2);
  });

  it('combines the token filter with the status filter', () => {
    const streams = [
      makeStream({ id: 'a', tokenAddress: 'CNATIVE', status: 'ACTIVE' }),
      makeStream({ id: 'b', tokenAddress: 'CNATIVE', status: 'CANCELLED' }),
      makeStream({ id: 'c', tokenAddress: 'CUSDC', status: 'ACTIVE' }),
    ];

    expect(filterStreams(streams, 'ACTIVE', '', 'CNATIVE').map((s) => s.id)).toEqual(['a']);
  });
});
