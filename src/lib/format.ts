import { getNativeAssetAddress, getUsdcAssetAddress } from './stellar';

// Every Stellar Asset Contract token (native XLM included) uses 7 decimal
// places — fixed by the protocol, not something per-asset to look up.
export const TOKEN_DECIMALS = 7;

// Fixed at 'en-US' rather than the viewer's browser locale (issue #155): a
// locale-dependent decimal separator makes the same on-screen amount read
// as two different numbers for two viewers (",5" is 5 for a de-DE reader
// but a fraction for an en-US one), which is ambiguous for money in a way
// it isn't for ordinary UI text. Every viewer of the same stream must see
// the same digits, comma for grouping and period for the decimal point,
// regardless of their own browser's locale setting.
const AMOUNT_LOCALE = 'en-US';

// A raw i128 amount, as the backend sends it, is always a bare (optionally
// signed) integer string -- BigInt() also accepts "0x1", " 1", "" and other
// forms that aren't valid amounts, so this is stricter than just "does
// BigInt() throw".
const RAW_AMOUNT_PATTERN = /^-?\d+$/;

/** Formats a raw i128 amount string (as returned by the backend) into a
 * human-readable decimal. Splits the integer/fractional parts on the
 * BigInt directly, so precision is preserved even for values well past
 * Number.MAX_SAFE_INTEGER. Always renders with 'en-US' grouping/decimal
 * conventions (comma thousands separator, period decimal point) regardless
 * of the viewer's browser locale (issue #155).
 *
 * `decimals` defaults to TOKEN_DECIMALS (every Stellar Asset Contract, which
 * covers native XLM and USDC here) but a donor-supplied custom token can
 * declare a different scale, which the caller must look up via the token's
 * own `decimals()` (see getTokenDecimals in stellar.ts) and pass through.
 *
 * Returns '—' for a value that isn't a plain integer string (empty, `null`/
 * `undefined` slipping through at runtime, a decimal like "1.5", NaN, etc.)
 * instead of throwing (issue #216) -- the API's TypeScript types promise a
 * `string`, but a malformed response shouldn't take down the whole page. */
export function formatAmount(raw: string, decimals: number = TOKEN_DECIMALS): string {
  if (typeof raw !== 'string' || !RAW_AMOUNT_PATTERN.test(raw)) {
    return '—';
  }
  const value = BigInt(raw);
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;
  const divisor = 10n ** BigInt(decimals);

  const whole = abs / divisor;
  const fraction = abs % divisor;

  const wholeStr = whole.toLocaleString(AMOUNT_LOCALE);
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');

  const formatted = fractionStr ? `${wholeStr}.${fractionStr}` : wholeStr;
  return isNegative ? `-${formatted}` : formatted;
}

/** Formats a raw per-second rate with exactly the token's decimal places,
 * preserving i128 precision without converting the rate to Number. */
export function formatRate(raw: bigint, decimals: number = TOKEN_DECIMALS): string {
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(decimals, '0');
  const formatted = decimals === 0 ? whole.toString() : `${whole}.${fraction}`;
  return isNegative ? `-${formatted}` : formatted;
}

/** Short display label for a token contract: "XLM" for the native asset,
 * "USDC" for the configured USDC contract, and a shortened contract address
 * for anything else (there is no symbol lookup for arbitrary tokens). */
export function tokenSymbol(tokenAddress: string): string {
  if (tokenAddress === getNativeAssetAddress()) {
    return 'XLM';
  }
  if (tokenAddress === getUsdcAssetAddress()) {
    return 'USDC';
  }
  return truncateAddress(tokenAddress);
}

/** Like `tokenSymbol`, but for display contexts that want the token's full
 * identity rather than a shortened one: "XLM" for the native asset, or the
 * token's full (untruncated) contract address for anything else — there's
 * no symbol/name resolution for arbitrary tokens, only the native asset's
 * address is derivable client-side. */
export function tokenLabel(tokenAddress: string): string {
  return tokenAddress === getNativeAssetAddress() ? 'XLM' : tokenAddress;
}

/** `formatAmount` plus the token's symbol, so "100" can't be mistaken for
 * the wrong asset (e.g. "100 XLM", "100 USDC", "100 CABC…WXYZ"). */
export function formatTokenAmount(
  raw: string,
  tokenAddress: string,
  decimals: number = TOKEN_DECIMALS,
): string {
  return `${formatAmount(raw, decimals)} ${tokenSymbol(tokenAddress)}`;
}

/** Sums raw amounts per token and formats each total with its symbol,
 * joined by commas ("5 XLM, 2 USDC"). Amounts of different tokens are never
 * added together. Returns the bare "0" for an empty list. */
export function formatTokenTotals(entries: { tokenAddress: string; raw: bigint }[]): string {
  const totals = new Map<string, bigint>();
  for (const { tokenAddress, raw } of entries) {
    totals.set(tokenAddress, (totals.get(tokenAddress) ?? 0n) + raw);
  }
  if (totals.size === 0) {
    return '0';
  }
  return [...totals]
    .map(([tokenAddress, raw]) => formatTokenAmount(raw.toString(), tokenAddress))
    .join(', ');
}

/** Formats a raw i128 fee estimate (in stroops) for display next to a
 * pending transaction, or `null` when no estimate is available yet (e.g.
 * before the first simulation completes). */
export function formatEstimatedFee(feeStroops: string | undefined): string | null {
  if (!feeStroops) {
    return null;
  }
  return `≈ ${formatAmount(feeStroops)} XLM`;
}

/** Formats a raw bigint amount into a plain decimal string suitable for an HTML
 * <input type="number"> (no thousands separators, trimmed trailing zeros). */
export function formatAmountInput(raw: bigint, decimals: number = TOKEN_DECIMALS): string {
  if (raw <= 0n) return '0';
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}


/** Parses a user-typed decimal amount (e.g. from a text input) into a raw
 * i128 value in the token's base units, or `null` if the input isn't a
 * valid positive amount or has more than `decimals` decimal places.
 *
 * `decimals` defaults to TOKEN_DECIMALS — pass a token's actual decimals
 * (see getTokenDecimals in stellar.ts) when parsing an amount for a
 * custom token, which may not use the Stellar Asset Contract's 7.
 *
 * Works on the digits as strings rather than going through Number(), which
 * silently changes values past ~15 significant digits. */
export function parseAmount(input: string, decimals: number = TOKEN_DECIMALS): bigint | null {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(input.trim());
  if (!match) {
    return null;
  }

  const [, whole, fraction = ''] = match;
  if (whole === '' && fraction === '') {
    return null;
  }
  if (fraction.length > decimals) {
    return null;
  }

  const raw = BigInt((whole || '0') + fraction.padEnd(decimals, '0'));
  return raw > 0n ? raw : null;
}

/** Explains why `parseAmount(input, decimals)` would return `null`, for
 * showing next to a disabled submit/confirm button (issue #203) — `null`
 * itself gives no way to tell "too many decimals" apart from "empty" or
 * "zero". Returns `null` (no message) for an empty input, since that's the
 * untouched/default state rather than a mistake to flag. */
export function describeAmountError(
  input: string,
  decimals: number = TOKEN_DECIMALS,
): string | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }

  const match = /^(\d*)(?:\.(\d*))?$/.exec(trimmed);
  if (!match || (match[1] === '' && (match[2] ?? '') === '')) {
    return 'Enter a valid amount.';
  }

  const [, whole, fraction = ''] = match;
  if (fraction.length > decimals) {
    return `Use at most ${decimals} decimal places.`;
  }

  const raw = BigInt((whole || '0') + fraction.padEnd(decimals, '0'));
  if (raw <= 0n) {
    return 'Enter an amount greater than 0.';
  }

  return null;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

function pluralize(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/**
 * Estimates how long a stream's remaining balance will last at its current
 * rate, as a human-readable string (e.g. "~3 days remaining").
 *
 * `balance` and `rate` are both raw i128 strings at the same token scale
 * (see TOKEN_DECIMALS), so dividing one by the other cancels the scale out
 * and yields a plain number of seconds — no decimal conversion needed.
 *
 * @param balance - The stream's remaining raw balance.
 * @param rate - The stream's raw per-second rate.
 * @returns "Fully drained" once the balance is zero, "" if the rate is zero
 * (nothing to divide by — a stream that isn't actually draining), or an
 * "~N unit(s) remaining" estimate otherwise.
 */
export function formatRemainingDuration(balance: string, rate: string): string {
  const balanceRaw = BigInt(balance);
  if (balanceRaw <= 0n) {
    return 'Fully drained';
  }

  const rateRaw = BigInt(rate);
  if (rateRaw <= 0n) {
    return '';
  }

  const totalSeconds = Number(balanceRaw / rateRaw);

  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `~${pluralize(totalSeconds, 'second')} remaining`;
  }
  if (totalSeconds < SECONDS_PER_HOUR) {
    return `~${pluralize(Math.floor(totalSeconds / SECONDS_PER_MINUTE), 'minute')} remaining`;
  }
  if (totalSeconds < SECONDS_PER_DAY) {
    return `~${pluralize(Math.floor(totalSeconds / SECONDS_PER_HOUR), 'hour')} remaining`;
  }
  return `~${pluralize(Math.floor(totalSeconds / SECONDS_PER_DAY), 'day')} remaining`;
}

/** Shortens a wallet/contract address to its first and last 4 characters.
 * Returns the original string unchanged if it is too short to truncate
 * without the two halves overlapping (i.e. fewer than 9 characters). */
export function truncateAddress(address: string): string {
  if (address.length < 9) {
    return address;
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Formats an ISO timestamp as a bare date (no time), in the viewer's own
 * locale and timezone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** Formats an ISO timestamp as a date and time, in the viewer's own locale
 * and timezone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
