import type { Stream } from './api';
import { formatRemainingDuration, formatTokenAmount, tokenLabel } from './format';

const UTF8_BOM = '\uFEFF';

const CSV_HEADERS = [
  'Stream ID',
  'NGO',
  'Token',
  'Status',
  'Committed',
  'Withdrawn',
  'Rate per second',
  'Remaining',
  'Created',
];

function escapeCsvField(value: string): string {
  // A field starting with =, +, - or @ runs as a formula when opened in a
  // spreadsheet — prefix it with a single quote so it's read as literal
  // text instead (the standard CSV injection mitigation).
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Builds a CSV of a donor's streams for the dashboard's "Export CSV"
 * button — one row per stream, amounts run through formatTokenAmount. Prefixed with
 * a UTF-8 BOM so spreadsheet applications correctly decode non-ASCII characters. */
export function buildDonationHistoryCsv(streams: Stream[]): string {
  const rows = streams.map((stream) => {
    const committed = BigInt(stream.balance) + BigInt(stream.withdrawn);
    return [
      stream.onChainId,
      stream.ngo.name,
      tokenLabel(stream.tokenAddress),
      stream.status === 'ACTIVE' ? 'Active' : 'Cancelled',
      formatTokenAmount(committed.toString(), stream.tokenAddress),
      formatTokenAmount(stream.withdrawn, stream.tokenAddress),
      formatTokenAmount(stream.rate, stream.tokenAddress),
      formatRemainingDuration(stream.balance, stream.rate),
      new Date(stream.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' }),
    ].map(escapeCsvField);
  });

  return UTF8_BOM + [CSV_HEADERS, ...rows].map((row) => row.join(',')).join('\n');
}
