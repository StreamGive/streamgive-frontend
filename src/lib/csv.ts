import type { Stream } from './api';
import { formatAmount } from './format';
import { getNativeAssetAddress } from './stellar';

const CSV_HEADERS = ['NGO', 'Token', 'Status', 'Committed', 'Withdrawn', 'Created'];

// There's no symbol/name resolution for arbitrary tokens — only the native
// asset's contract address is derivable client-side.
function tokenLabel(tokenAddress: string): string {
  return tokenAddress === getNativeAssetAddress() ? 'XLM' : tokenAddress;
}

function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Builds a CSV of a donor's streams for the dashboard's "Export CSV"
 * button — one row per stream, amounts run through formatAmount. */
export function buildDonationHistoryCsv(streams: Stream[]): string {
  const rows = streams.map((stream) => {
    const committed = BigInt(stream.balance) + BigInt(stream.withdrawn);
    return [
      stream.ngo.name,
      tokenLabel(stream.tokenAddress),
      stream.status === 'ACTIVE' ? 'Active' : 'Cancelled',
      formatAmount(committed.toString()),
      formatAmount(stream.withdrawn),
      new Date(stream.createdAt).toLocaleDateString(),
    ].map(escapeCsvField);
  });

  return [CSV_HEADERS, ...rows].map((row) => row.join(',')).join('\n');
}
