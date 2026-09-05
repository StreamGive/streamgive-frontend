// Every Stellar Asset Contract token (native XLM included) uses 7 decimal
// places — fixed by the protocol, not something per-asset to look up.
const TOKEN_DECIMALS = 7;

/** Formats a raw i128 amount string (as returned by the backend) into a
 * human-readable decimal. Safe for typical donation-sized amounts; not
 * intended for values anywhere near Number.MAX_SAFE_INTEGER. */
export function formatAmount(raw: string): string {
  return (Number(BigInt(raw)) / 10 ** TOKEN_DECIMALS).toLocaleString(undefined, {
    maximumFractionDigits: 7,
  });
}
