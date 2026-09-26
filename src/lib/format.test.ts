import { describe, expect, it } from 'vitest';

import { parseAmount, truncateAddress } from './format';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it('formats a typical amount correctly', () => {
    // 10_0000000 base units = 10 XLM
    expect(formatAmount('100000000')).toBe(
      (10).toLocaleString(undefined, { maximumFractionDigits: 7 }),
    );
  });

  it('formats zero as 0', () => {
    expect(formatAmount('0')).toBe(
      (0).toLocaleString(undefined, { maximumFractionDigits: 7 }),
    );
  });

  it('formats a large value near safe integer precision', () => {
    // 9_000_000 XLM = 90_000_000_0000000 base units (well within i128, close
    // to the upper end of typical treasury balances used in production)
    const raw = '900000000000000'; // 9_000_000 XLM
    expect(formatAmount(raw)).toBe(
      (9_000_000).toLocaleString(undefined, { maximumFractionDigits: 7 }),
    );
  });
});

describe('truncateAddress', () => {
  it('truncates a full-length Stellar address', () => {
    const address = 'G' + 'A'.repeat(55);
    expect(truncateAddress(address)).toBe('GAAA…AAAA');
  });

  it('returns the original string when it is shorter than 9 characters', () => {
    expect(truncateAddress('GABC')).toBe('GABC');
    expect(truncateAddress('')).toBe('');
    expect(truncateAddress('GABCDEFG')).toBe('GABCDEFG');
  });

  it('truncates a string of exactly 9 characters without overlap', () => {
    // 4 + ellipsis + 4 = 9, so the boundary case should still truncate
    expect(truncateAddress('ABCDE1234')).toBe('ABCD…1234');
  });
});
