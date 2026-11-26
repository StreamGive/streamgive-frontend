import type { Stream } from '@/lib/api';

export type StreamFilter = 'ALL' | 'ACTIVE' | 'CANCELLED';

export type SortOrder = 'newest' | 'oldest' | 'largest-committed' | 'ending-soonest';

// A donor with live streams lands on the Active tab, anyone else on All.
export function initialStreamFilter(streams: Stream[]): StreamFilter {
  return streams.some((s) => s.status === 'ACTIVE') ? 'ACTIVE' : 'ALL';
}

// `query` is expected to be trimmed. An empty query never excludes anything,
// so clearing the search box naturally clears the filter. `token` is a token
// contract address; an empty value means "all tokens".
export function filterStreams(
  streams: Stream[],
  filter: StreamFilter,
  query: string,
  token = '',
): Stream[] {
  return streams.filter((s) => {
    if (token && s.tokenAddress !== token) return false;
    if (filter === 'ACTIVE' && s.status !== 'ACTIVE') return false;
    if (filter === 'CANCELLED' && s.status !== 'CANCELLED') return false;
    if (query && !s.onChainId.includes(query)) return false;
    return true;
  });
}

export function sortStreams(streams: Stream[], sortOrder: SortOrder): Stream[] {
  return [...streams].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortOrder === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortOrder === 'largest-committed') {
      const commA = BigInt(a.balance) + BigInt(a.withdrawn);
      const commB = BigInt(b.balance) + BigInt(b.withdrawn);
      if (commB > commA) return 1;
      if (commB < commA) return -1;
      return 0;
    }
    if (sortOrder === 'ending-soonest') {
      const getRemaining = (s: Stream) => {
        if (s.status !== 'ACTIVE' || BigInt(s.rate) <= 0n) return 999999999999999n;
        const b = BigInt(s.balance);
        if (b <= 0n) return 0n;
        return b / BigInt(s.rate);
      };
      const remA = getRemaining(a);
      const remB = getRemaining(b);
      if (remA > remB) return 1;
      if (remA < remB) return -1;
      return 0;
    }
    return 0;
  });
}
