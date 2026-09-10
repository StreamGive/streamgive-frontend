// Every Stellar Asset Contract token (native XLM included) uses 7 decimal
// places — fixed by the protocol, not something per-asset to look up.
export const TOKEN_DECIMALS = 7;

/** Formats a raw i128 amount string (as returned by the backend) into a
 * human-readable decimal. Safe for typical donation-sized amounts; not
 * intended for values anywhere near Number.MAX_SAFE_INTEGER. */
export function formatAmount(raw: string): string {
  return (Number(BigInt(raw)) / 10 ** TOKEN_DECIMALS).toLocaleString(undefined, {
    maximumFractionDigits: 7,
  });
}

/** Parses a user-typed decimal amount (e.g. from a text input) into a raw
 * i128 value in the token's base units, or `null` if the input isn't a
 * valid positive amount. */
export function parseAmount(input: string): bigint | null {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return BigInt(Math.round(value * 10 ** TOKEN_DECIMALS));
/** Shortens a wallet/contract address to its first and last 4 characters. */
export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
