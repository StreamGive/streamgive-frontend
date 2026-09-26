import { describe, expect, it } from 'vitest';

import { parseAmount, truncateAddress } from './format';

describe('parseAmount', () => {
  it('keeps every digit of a large whole amount', () => {
    // 20 significant digits once scaled — well past what a float can hold.
    expect(parseAmount('1234567890123')).toBe(12345678901230000000n);
  });

  it('accepts exactly 7 decimal places', () => {
    expect(parseAmount('1.2345678')).toBe(12345678n);
    expect(parseAmount('0.0000001')).toBe(1n);
  });

  it('keeps precision when a large amount has 7 decimal places', () => {
    expect(parseAmount('98765432109.1234567')).toBe(987654321091234567n);
  });

  it('rejects more than 7 decimal places', () => {
    expect(parseAmount('1.23456789')).toBeNull();
    expect(parseAmount('0.00000001')).toBeNull();
  });

  it('rejects invalid input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('1e5')).toBeNull();
    expect(parseAmount('0')).toBeNull();
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
