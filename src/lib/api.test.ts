import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getNgos, getStreams } from './api';
import { getNgo, getWithdrawals, lookupNgoByAddress, submitNgoApplication } from './api';

// A hung/unreachable backend must surface as a rejected promise rather than
// resolve to something falsy. AbortSignal.timeout() rejects fetch with a
// TimeoutError, and an offline network / DNS failure rejects it with
// TypeError ("fetch failed") — api.ts has no try/catch, so both must
// propagate to the caller untouched.
const networkFailure = new TypeError('fetch failed');

describe('api network errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getNgos rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkFailure;
      }),
    );

    await expect(getNgos()).rejects.toThrow(TypeError);
    await expect(getNgos()).rejects.toThrow('fetch failed');
  });

  it('getStreams rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkFailure;
      }),
    );

    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow(TypeError);
    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow('fetch failed');
  });

  it(
    'rejects once a stalled request hits the 10s timeout',
    async () => {
      // AbortSignal.timeout() schedules its own internal timer outside of
      // the global setTimeout/setInterval that vi.useFakeTimers() patches,
      // so it keeps running on the real clock even under fake timers —
      // this has to let the real 10s elapse rather than fast-forward it.
      //
      // A realistic hung fetch: the promise it returns never settles on its
      // own — it only rejects if/when the signal passed to it aborts, same
      // as a real fetch() would once AbortSignal.timeout() fires.
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(options.signal?.reason);
            });
          });
        }),
      );

      await expect(getNgos()).rejects.toBeTruthy();
    },
    15_000,
  );
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ngoProfile = {
  id: 'ngo-1',
  ownerAddress: 'GABC',
  name: 'Test NGO',
  verified: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  description: 'A description',
  website: 'https://example.com',
  country: 'US',
  stats: {
    totalCommitted: '1000000000',
    totalWithdrawn: '500000000',
    activeStreamCount: 2,
    donorCount: 5,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// getNgo
// ---------------------------------------------------------------------------

describe('getNgo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the NGO profile on a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(ngoProfile))));

    const result = await getNgo('ngo-1');
    expect(result).toEqual(ngoProfile);
  });

  it('returns null for a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'not found' }, 404))),
    );

    const result = await getNgo('does-not-exist');
    expect(result).toBeNull();
  });

  it('throws for a non-ok, non-404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'server error' }, 500))),
    );

    await expect(getNgo('ngo-1')).rejects.toThrow(/500/);
  });

  it('URL-encodes the id in the request URL', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(ngoProfile)));
    vi.stubGlobal('fetch', fetchMock);

    await getNgo('ngo/with spaces');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('ngo%2Fwith%20spaces');
  });

  it('rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(getNgo('ngo-1')).rejects.toThrow('fetch failed');
  });
});

// ---------------------------------------------------------------------------
// lookupNgoByAddress
// ---------------------------------------------------------------------------

describe('lookupNgoByAddress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the NGO profile on a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(ngoProfile))));

    const result = await lookupNgoByAddress('GABC');
    expect(result).toEqual(ngoProfile);
  });

  it('returns null for a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'not found' }, 404))),
    );

    const result = await lookupNgoByAddress('GUNKNOWN');
    expect(result).toBeNull();
  });

  it('throws for a non-ok, non-404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'server error' }, 500))),
    );

    await expect(lookupNgoByAddress('GABC')).rejects.toThrow(/500/);
  });

  it('passes the address as a query parameter', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(ngoProfile)));
    vi.stubGlobal('fetch', fetchMock);

    await lookupNgoByAddress('GABC123');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('address=GABC123');
  });

  it('rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(lookupNgoByAddress('GABC')).rejects.toThrow('fetch failed');
  });
});

// ---------------------------------------------------------------------------
// getWithdrawals
// ---------------------------------------------------------------------------

describe('getWithdrawals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const withdrawals = [
    { id: 'w-1', streamId: '42', amount: '500000000', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'w-2', streamId: '42', amount: '250000000', createdAt: '2026-01-02T00:00:00Z' },
  ];

  it('returns the withdrawals array on a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(withdrawals))));

    const result = await getWithdrawals('ngo-1');
    expect(result).toEqual(withdrawals);
  });

  it('throws for a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'forbidden' }, 403))),
    );

    await expect(getWithdrawals('ngo-1')).rejects.toThrow(/403/);
  });

  it('URL-encodes the ngoId in the request URL', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(withdrawals)));
    vi.stubGlobal('fetch', fetchMock);

    await getWithdrawals('ngo/with spaces');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('ngo%2Fwith%20spaces');
  });

  it('rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(getWithdrawals('ngo-1')).rejects.toThrow('fetch failed');
  });
});

// ---------------------------------------------------------------------------
// submitNgoApplication
// ---------------------------------------------------------------------------

describe('submitNgoApplication', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input = {
    ownerAddress: 'GABC',
    name: 'Test NGO',
    description: 'A description',
    contactEmail: 'test@example.com',
  };

  const createdApplication = {
    id: 'app-1',
    ownerAddress: 'GABC',
    name: 'Test NGO',
    description: 'A description',
    website: null,
    contactEmail: 'test@example.com',
    country: null,
    status: 'PENDING' as const,
    reviewNote: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('returns the created application on a 201 response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(createdApplication, 201))));

    const result = await submitNgoApplication(input);
    expect(result).toEqual(createdApplication);
  });

  it('returns the created application on a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(createdApplication, 200))));

    const result = await submitNgoApplication(input);
    expect(result).toEqual(createdApplication);
  });

  it('throws ApiError with status 409 when a duplicate application is detected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ error: 'An application from this address is already pending.' }, 409),
        ),
      ),
    );

    const error = await submitNgoApplication(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
  });

  it('throws ApiError for a generic non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse({ message: 'Validation failed' }, 400)),
      ),
    );

    const error = await submitNgoApplication(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
  });

  it('includes zod validation details in the error message when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            {
              message: 'Validation failed',
              details: [{ path: ['contactEmail'], message: 'Invalid email' }],
            },
            400,
          ),
        ),
      ),
    );

    const error = await submitNgoApplication(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/contactEmail.*Invalid email/);
  });

  it('sends the input as JSON in the request body', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(createdApplication, 201)));
    vi.stubGlobal('fetch', fetchMock);

    await submitNgoApplication(input);

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledInit.method).toBe('POST');
    expect(JSON.parse(calledInit.body as string)).toEqual(input);
  });

  it('rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(submitNgoApplication(input)).rejects.toThrow('fetch failed');
  });
});
