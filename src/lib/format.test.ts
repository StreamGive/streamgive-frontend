import { describe, expect, it } from 'vitest';

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
