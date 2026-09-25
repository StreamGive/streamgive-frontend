import { describe, expect, it } from 'vitest';

import type { Stream } from './api';
import { buildDonationHistoryCsv } from './csv';
import { getNativeAssetAddress } from './stellar';

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 's1',
    onChainId: '1',
    tokenAddress: getNativeAssetAddress(),
    rate: '100',
    balance: '5000000',
    withdrawn: '2000000',
    status: 'ACTIVE',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    donor: { address: 'GDONOR' },
    ngo: { id: 'ngo1', name: 'Test NGO', ownerAddress: 'GOWNER' },
    ...overrides,
  };
}

describe('buildDonationHistoryCsv', () => {
  it('emits a header row and one row per stream', () => {
    const csv = buildDonationHistoryCsv([makeStream()]);
    const [header, row] = csv.split('\n');

    expect(header).toBe('NGO,Token,Status,Committed,Withdrawn,Created');
    expect(row).toBe('Test NGO,XLM,Active,0.7,0.2,1/15/2026');
  });

  it('labels non-native tokens by contract address and cancelled streams as Cancelled', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ tokenAddress: 'CUSDCCONTRACT', status: 'CANCELLED' }),
    ]);
    const [, row] = csv.split('\n');

    expect(row).toBe('Test NGO,CUSDCCONTRACT,Cancelled,0.7,0.2,1/15/2026');
  });

  it('quotes fields containing a comma', () => {
    const csv = buildDonationHistoryCsv([makeStream({ ngo: { id: 'ngo1', name: 'Hope, Inc.', ownerAddress: 'GOWNER' } })]);
    const [, row] = csv.split('\n');

    expect(row).toBe('"Hope, Inc.",XLM,Active,0.7,0.2,1/15/2026');
  });

  it('returns just the header for no streams', () => {
    expect(buildDonationHistoryCsv([])).toBe('NGO,Token,Status,Committed,Withdrawn,Created');
  });
});
