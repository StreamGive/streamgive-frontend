import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { describeAmountError, formatAmountInput, parseAmount, truncateAddress } from './format';
import { formatAmount, formatTokenAmount, formatTokenTotals } from './format';
import { formatEstimatedFee, formatRate, formatRemainingDuration } from './format';
import { getNativeAssetAddress, getUsdcAssetAddress } from './stellar';

describe('formatAmount', () => {
  it('formats a typical amount correctly', () => {
    // 10_0000000 base units = 10 XLM
    expect(formatAmount('100000000')).toBe('10');
  });

  it('formats zero as 0', () => {
    expect(formatAmount('0')).toBe('0');
  });

  it('formats a large value near safe integer precision', () => {
    // 9_000_000 XLM = 90_000_000_0000000 base units (well within i128, close
    // to the upper end of typical treasury balances used in production)
    const raw = '90000000000000'; // 9_000_000 XLM
    expect(formatAmount(raw)).toBe('9,000,000');
  });

  it('does not lose precision for a raw amount past Number.MAX_SAFE_INTEGER', () => {
    // 9007199254740993 can't be represented exactly as a JS double (it
    // rounds down to ...992), so a naive Number(BigInt(raw)) conversion
    // would corrupt the last digit before the division even happens.
    const raw = '9007199254740993';
    expect(formatAmount(raw)).toBe('900,719,925.4740993');
  });

  // issue #155: the same raw amount must render identically no matter which
  // locale the viewer's browser is set to -- the previous implementation's
  // BigInt.toLocaleString(undefined, ...) would have rendered the whole part
  // with de-DE's period grouping separator and its own decimal-separator
  // lookup would have returned "," for the same browser, together producing
  // "1.234,5" instead of the fixed "1,234.5" every viewer must see.
  describe('under a non-default browser locale', () => {
    // Monkey-patches BigInt.prototype.toLocaleString to render as de-DE
    // (period grouping, comma decimal) whenever called with no explicit
    // locale, exactly mimicking what a de-DE browser's Intl implementation
    // does -- so this test fails the same way a real de-DE browser would if
    // formatAmount ever went back to passing `undefined` instead of a fixed
    // locale.
    const original = BigInt.prototype.toLocaleString;

    beforeEach(() => {
      vi.spyOn(BigInt.prototype, 'toLocaleString').mockImplementation(function (
        this: bigint,
        ...args: Parameters<typeof original>
      ) {
        const [locale, opts] = args;
        return original.call(this, locale ?? 'de-DE', opts);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('still renders en-US grouping and decimal separators', () => {
      expect(formatAmount('90000000000000')).toBe('9,000,000');
      expect(formatAmount('15000000')).toBe('1.5');
    });
  });

  // issue #216: a malformed API value (empty string, a decimal, null/
  // undefined slipping through at runtime despite the `string` type) used
  // to throw inside BigInt() and take down the whole page via error.tsx.
  describe('given a malformed raw value', () => {
    it('returns the placeholder instead of throwing for an empty string', () => {
      expect(formatAmount('')).toBe('—');
    });

    it('returns the placeholder instead of throwing for a decimal string', () => {
      expect(formatAmount('1.5')).toBe('—');
    });

    it('returns the placeholder instead of throwing for null/undefined', () => {
      // The API's type says `string`, but a malformed response can still
      // send null/undefined at runtime.
      expect(formatAmount(null as unknown as string)).toBe('—');
      expect(formatAmount(undefined as unknown as string)).toBe('—');
    });

    it('returns the placeholder instead of throwing for non-numeric text', () => {
      expect(formatAmount('not-a-number')).toBe('—');
    });
  });
});

describe('formatRate', () => {
  it('preserves every digit above Number.MAX_SAFE_INTEGER', () => {
    expect(formatRate(9007199254740993n)).toBe('900719925.4740993');
  });

  it('formats the maximum i128 value without rounding or scientific notation', () => {
    expect(formatRate(170141183460469231731687303715884105727n)).toBe(
      '17014118346046923173168730371588.4105727',
    );
  });

  it.each([
    [0n, '0.0000000'],
    [1n, '0.0000001'],
    [385n, '0.0000385'],
    [10000000n, '1.0000000'],
    [-1n, '-0.0000001'],
  ])('formats %s with seven decimal places', (raw, expected) => {
    expect(formatRate(raw)).toBe(expected);
  });

  it('respects custom token decimals, including zero', () => {
    expect(formatRate(9007199254740993n, 6)).toBe('9007199254.740993');
    expect(formatRate(1050000n, 6)).toBe('1.050000');
    expect(formatRate(42n, 0)).toBe('42');
  });
});

describe('parseAmount', () => {
  it('accepts a whole amount written with leading zeros', () => {
    // '007' is 7 XLM either way — 7 * 10^7 base units. The leading zeros
    // must not be read as an octal literal or truncated.
    expect(parseAmount('007')).toBe(70_000_000n);
  });

  it('accepts a trailing decimal separator with no fractional digits', () => {
    // '5.' is a normal intermediate state while typing '5.5'; the empty
    // fraction is worth zero, so the amount is exactly 5 XLM.
    expect(parseAmount('5.')).toBe(50_000_000n);
  });

  it('accepts a fractional-only amount with no integer part', () => {
    // '.5' is half an XLM — 0.5 * 10^7 = 5_000_000 base units. The missing
    // whole part is read as 0 rather than making the input invalid.
    expect(parseAmount('.5')).toBe(5_000_000n);
  });

  it('respects a custom decimals count instead of always assuming 7 (#204)', () => {
    // A 6-decimal token: '1.5' is 1_500_000 base units, not the 7-decimal
    // 15_000_000 that the default would produce.
    expect(parseAmount('1.5', 6)).toBe(1_500_000n);
    // More than 6 fractional digits is invalid at that token's own scale,
    // even though it would be fine at the default 7.
    expect(parseAmount('1.5000000', 6)).toBeNull();
  });
});

describe('describeAmountError', () => {
  // issue #203: parseAmount's null return can't tell a caller why an amount
  // was rejected, so the submit/Confirm button was just disabled with no
  // explanation. describeAmountError gives that reason instead.
  it('returns null for an untouched empty input', () => {
    expect(describeAmountError('')).toBeNull();
    expect(describeAmountError('   ')).toBeNull();
  });

  it('explains a zero amount', () => {
    expect(describeAmountError('0')).toBe('Enter an amount greater than 0.');
  });

  it('explains more than the allowed number of decimal places', () => {
    expect(describeAmountError('1.23456789')).toBe('Use at most 7 decimal places.');
  });

  it('uses a custom decimals count in the message for a non-SAC token (#204)', () => {
    expect(describeAmountError('1.1234567', 6)).toBe('Use at most 6 decimal places.');
  });

  it('explains input that is not a plain number, like scientific notation', () => {
    expect(describeAmountError('1e3')).toBe('Enter a valid amount.');
  });

  it('returns null for a valid amount', () => {
    expect(describeAmountError('5.5')).toBeNull();
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

describe('formatTokenAmount', () => {
  it('appends XLM for the native asset', () => {
    expect(formatTokenAmount('1000000000', getNativeAssetAddress())).toBe('100 XLM');
  });

  it('appends USDC for the USDC contract', () => {
    expect(formatTokenAmount('15000000', getUsdcAssetAddress())).toBe('1.5 USDC');
  });

  it('appends a shortened address for any other token', () => {
    expect(formatTokenAmount('10000000', 'CABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('1 CABC…WXYZ');
  });

  it('honours a custom decimals value', () => {
    expect(formatTokenAmount('1500', getNativeAssetAddress(), 3)).toBe('1.5 XLM');
  });
});

describe('formatTokenTotals', () => {
  it('sums per token and never mixes tokens', () => {
    const xlm = getNativeAssetAddress();
    const usdc = getUsdcAssetAddress();

    expect(
      formatTokenTotals([
        { tokenAddress: xlm, raw: 10000000n },
        { tokenAddress: usdc, raw: 20000000n },
        { tokenAddress: xlm, raw: 5000000n },
      ]),
    ).toBe('1.5 XLM, 2 USDC');
  });

  it('returns a bare 0 for no entries', () => {
    expect(formatTokenTotals([])).toBe('0');
  });
});

describe('formatRemainingDuration', () => {
  // Each raw value is i128 in the same token scale — dividing balance by rate
  // cancels the scale, yielding a plain number of seconds.

  it('returns "Fully drained" when balance is zero', () => {
    expect(formatRemainingDuration('0', '1000000')).toBe('Fully drained');
  });

  it('returns "Fully drained" when balance is negative', () => {
    expect(formatRemainingDuration('-1', '1000000')).toBe('Fully drained');
  });

  it('returns empty string when rate is zero (stream not draining)', () => {
    expect(formatRemainingDuration('1000000', '0')).toBe('');
  });

  it('returns empty string when rate is negative', () => {
    expect(formatRemainingDuration('1000000', '-1')).toBe('');
  });

  it('returns seconds for a duration under one minute', () => {
    // balance / rate = 45 seconds
    expect(formatRemainingDuration('45', '1')).toBe('~45 seconds remaining');
  });

  it('uses singular "second" for exactly 1 second', () => {
    expect(formatRemainingDuration('1', '1')).toBe('~1 second remaining');
  });

  it('returns "~0 seconds remaining" for a balance that rounds down to zero seconds', () => {
    // balance (1) / rate (2) = 0 seconds (BigInt division truncates toward zero)
    expect(formatRemainingDuration('1', '2')).toBe('~0 seconds remaining');
  });

  it('returns minutes for a duration of exactly 60 seconds', () => {
    expect(formatRemainingDuration('60', '1')).toBe('~1 minute remaining');
  });

  it('returns minutes for a duration under one hour', () => {
    // 2700 seconds = 45 minutes
    expect(formatRemainingDuration('2700', '1')).toBe('~45 minutes remaining');
  });

  it('uses singular "minute" for exactly 1 minute', () => {
    expect(formatRemainingDuration('60', '1')).toBe('~1 minute remaining');
  });

  it('returns hours for a duration of exactly 3600 seconds', () => {
    expect(formatRemainingDuration('3600', '1')).toBe('~1 hour remaining');
  });

  it('returns hours for a duration under one day', () => {
    // 43200 seconds = 12 hours
    expect(formatRemainingDuration('43200', '1')).toBe('~12 hours remaining');
  });

  it('uses singular "hour" for exactly 1 hour', () => {
    expect(formatRemainingDuration('3600', '1')).toBe('~1 hour remaining');
  });

  it('returns days for a duration of exactly 86400 seconds', () => {
    expect(formatRemainingDuration('86400', '1')).toBe('~1 day remaining');
  });

  it('returns days for multi-day durations', () => {
    // 7 days = 604800 seconds
    expect(formatRemainingDuration('604800', '1')).toBe('~7 days remaining');
  });

  it('uses singular "day" for exactly 1 day', () => {
    expect(formatRemainingDuration('86400', '1')).toBe('~1 day remaining');
  });

  it('returns days (not months) for 30 days', () => {
    // formatRemainingDuration does not have a months branch — 30+ days stay as days
    expect(formatRemainingDuration('2592000', '1')).toBe('~30 days remaining');
  });

  it('divides balance by rate correctly when both are large token-scale values', () => {
    // 86400 * 10_000_000 stroops of balance at 10_000_000 per second = 86400 s = 1 day
    expect(formatRemainingDuration('864000000000', '10000000')).toBe('~1 day remaining');
  });
});

describe('formatEstimatedFee', () => {
  it('returns null for undefined', () => {
    expect(formatEstimatedFee(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(formatEstimatedFee('')).toBeNull();
  });

  it('formats a fee in stroops as an XLM amount with the ≈ prefix', () => {
    // 1_000_000 stroops = 0.1 XLM
    expect(formatEstimatedFee('1000000')).toBe('≈ 0.1 XLM');
  });

  it('formats a whole-number fee without a decimal part', () => {
    // 10_000_000 stroops = 1 XLM (no fractional part)
    expect(formatEstimatedFee('10000000')).toBe('≈ 1 XLM');
  });

  it('formats a small fee (100 stroops = 0.00001 XLM)', () => {
    expect(formatEstimatedFee('100')).toBe('≈ 0.00001 XLM');
  });
});

describe('formatAmountInput', () => {
  it('formats whole amounts without decimals', () => {
    expect(formatAmountInput(50000000000n)).toBe('5000');
  });

  it('formats fractional amounts without grouping commas', () => {
    expect(formatAmountInput(49989000000n)).toBe('4998.9');
  });

  it('handles custom token decimals', () => {
    expect(formatAmountInput(1050000n, 6)).toBe('1.05');
  });

  it('returns 0 for zero or negative values', () => {
    expect(formatAmountInput(0n)).toBe('0');
    expect(formatAmountInput(-500n)).toBe('0');
  });
});

