import { describe, expect, it } from 'vitest';

import type { Stream, Withdrawal } from './api';
import { buildDonationHistoryCsv, buildWithdrawalHistoryCsv } from './csv';
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
  it('emits a UTF-8 BOM, a header row and one row per stream with all details', () => {
    const csv = buildDonationHistoryCsv([makeStream()]);
    const [header, row] = csv.split('\n');

    expect(header).toBe(
      '\uFEFFStream ID,NGO,Token,Status,Committed,Withdrawn,Rate per second,Remaining,Created',
    );
    expect(row).toBe('1,Test NGO,XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026');
  });

  it('prefixes the output with a UTF-8 BOM so spreadsheet apps handle non-ASCII names', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ ngo: { id: 'ngo1', name: 'Médecins du Monde', ownerAddress: 'GOWNER' } }),
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Médecins du Monde');
  });

  it('labels non-native tokens by contract address and cancelled streams as Cancelled', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ tokenAddress: 'CUSDCCONTRACT', status: 'CANCELLED' }),
    ]);
    const [, row] = csv.split('\n');

    expect(row).toBe(
      '1,Test NGO,CUSDCCONTRACT,Cancelled,0.7 CUSD…RACT,0.2 CUSD…RACT,0.00001 CUSD…RACT,~13 hours remaining,1/15/2026',
    );
  });

  it('quotes fields containing a comma', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ ngo: { id: 'ngo1', name: 'Hope, Inc.', ownerAddress: 'GOWNER' } }),
    ]);
    const [, row] = csv.split('\n');

    expect(row).toBe('1,"Hope, Inc.",XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026');
  });

  it('returns just the BOM and header for no streams', () => {
    expect(buildDonationHistoryCsv([])).toBe(
      '\uFEFFStream ID,NGO,Token,Status,Committed,Withdrawn,Rate per second,Remaining,Created',
    );
  });

  it('escapes names containing quotes', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ ngo: { id: 'ngo1', name: 'Hope "The Best" NGO', ownerAddress: 'GOWNER' } }),
    ]);
    const [, row] = csv.split('\n');

    expect(row).toBe(
      '1,"Hope ""The Best"" NGO",XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026',
    );
  });

  it('escapes names containing newlines', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ ngo: { id: 'ngo1', name: 'Hope\nNGO', ownerAddress: 'GOWNER' } }),
    ]);
    const [, row] = csv.split('\n');

    expect(row).toBe(
      '1,"Hope\nNGO",XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026',
    );
  });

  it('guards names that start with formula prefixes', () => {
    const csv = buildDonationHistoryCsv([
      makeStream({ ngo: { id: 'ngo1', name: '=Evil Corp', ownerAddress: 'GOWNER' } }),
      makeStream({ id: 's2', onChainId: '2', ngo: { id: 'ngo2', name: '+Plus NGO', ownerAddress: 'GOWNER' } }),
      makeStream({ id: 's3', onChainId: '3', ngo: { id: 'ngo3', name: '-Minus NGO', ownerAddress: 'GOWNER' } }),
      makeStream({ id: 's4', onChainId: '4', ngo: { id: 'ngo4', name: '@At NGO', ownerAddress: 'GOWNER' } }),
    ]);

    expect(csv.split('\n')).toEqual([
      '\uFEFFStream ID,NGO,Token,Status,Committed,Withdrawn,Rate per second,Remaining,Created',
      "1,'=Evil Corp,XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026",
      "2,'+Plus NGO,XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026",
      "3,'-Minus NGO,XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026",
      "4,'@At NGO,XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026",
    ]);
  });

  it('handles several thousand rows and asserts the exact output', () => {
    const streams = Array.from({ length: 3000 }, (_, index) =>
      makeStream({ id: `s${index + 1}`, onChainId: String(index + 1) }),
    );
    const csv = buildDonationHistoryCsv(streams);
    const lines = csv.split('\n');

    const expectedHeader =
      '\uFEFFStream ID,NGO,Token,Status,Committed,Withdrawn,Rate per second,Remaining,Created';
    const expectedRow =
      ',Test NGO,XLM,Active,0.7 XLM,0.2 XLM,0.00001 XLM,~13 hours remaining,1/15/2026';
    const expectedLines = [
      expectedHeader,
      ...streams.map((stream) => `${stream.onChainId}${expectedRow}`),
    ];

    expect(lines).toHaveLength(3001);
    expect(csv).toBe(expectedLines.join('\n'));
  });
});

describe('buildWithdrawalHistoryCsv', () => {
  const withdrawal: Withdrawal = {
    id: 'w1',
    streamId: '42',
    amount: '1000000000',
    createdAt: '2026-01-15T00:00:00.000Z',
  };

  it('emits a BOM, the Date, Stream ID and Amount columns and one row per withdrawal', () => {
    const csv = buildWithdrawalHistoryCsv([
      withdrawal,
      { ...withdrawal, id: 'w2', streamId: '7', amount: '25000000', createdAt: '2026-02-01T12:30:00.000Z' },
    ]);

    expect(csv.split('\n')).toEqual([
      '\uFEFFDate,Stream ID,Amount',
      '2026-01-15T00:00:00.000Z,42,100',
      '2026-02-01T12:30:00.000Z,7,2.5',
    ]);
  });

  it('returns just the BOM and header for an empty history', () => {
    expect(buildWithdrawalHistoryCsv([])).toBe('\uFEFFDate,Stream ID,Amount');
  });

  it('guards fields that would run as a spreadsheet formula', () => {
    const csv = buildWithdrawalHistoryCsv([{ ...withdrawal, streamId: '=HYPERLINK("http://x")' }]);
    const [, row] = csv.split('\n');

    expect(row).toBe('2026-01-15T00:00:00.000Z,"\'=HYPERLINK(""http://x"")",100');
  });
});
