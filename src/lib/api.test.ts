import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  getApplicationStatus,
  getBackendReady,
  getNgo,
  getNgos,
  getStreams,
  getWithdrawals,
  lookupNgoByAddress,
  submitNgoApplication,
} from './api';

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

// ---------------------------------------------------------------------------
// Failure-mode suite — covers every failure mode callers rely on
// ---------------------------------------------------------------------------

/**
 * Issue #477: a request can fail with a timeout, a 429 with Retry-After,
 * a 5xx with an HTML body, or a 200 with invalid JSON. Callers rely on
 * consistent, predictable error types from each case.
 */

// ── 1. Timeout ───────────────────────────────────────────────────────────────
// AbortSignal.timeout() fires after API_TIMEOUT_MS. The resulting TimeoutError
// is a DOMException whose name is "TimeoutError". Callers must receive it as a
// rejected promise rather than a resolved-but-falsy value.
describe('failure mode: timeout', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Shared: a fetch that only rejects when its AbortSignal fires.
  function stalledFetch() {
    return vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(options.signal?.reason);
        });
      });
    });
  }

  it('getNgos rejects with a TimeoutError when the request stalls', async () => {
    vi.stubGlobal('fetch', stalledFetch());
    // AbortSignal.timeout(10_000) fires on the real clock. Use a tiny
    // per-test timeout so the test completes in reasonable time.
    const tiny = AbortSignal.timeout(50);
    await expect(getNgos(tiny)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('getNgo rejects with a TimeoutError when the request stalls', async () => {
    vi.stubGlobal('fetch', stalledFetch());
    const tiny = AbortSignal.timeout(50);
    await expect(getNgo('ngo-1', tiny)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('getStreams rejects with a TimeoutError when the request stalls', async () => {
    vi.stubGlobal('fetch', stalledFetch());
    const tiny = AbortSignal.timeout(50);
    await expect(getStreams({ donor: 'GABC' }, tiny)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('getWithdrawals rejects with a TimeoutError when the request stalls', async () => {
    vi.stubGlobal('fetch', stalledFetch());
    const tiny = AbortSignal.timeout(50);
    await expect(getWithdrawals('ngo-1', tiny)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('submitNgoApplication rejects with a TimeoutError when the request stalls', async () => {
    vi.stubGlobal('fetch', stalledFetch());
    const tiny = AbortSignal.timeout(50);
    // submitNgoApplication calls withTimeout() internally; we pass the tiny
    // signal via the internal AbortSignal.any([signal, timeout]).
    // Because the internal timeout is 10 s, drive cancellation via the
    // stalled-fetch abort path with the signal embedded in fetch options.
    await expect(
      submitNgoApplication({
        ownerAddress: 'GABC',
        name: 'T',
        description: 'D',
        contactEmail: 'a@b.com',
      }),
    ).rejects.toMatchObject({ name: expect.stringMatching(/TimeoutError|AbortError/) });
  }, 15_000);
});

// ── 2. 429 Too Many Requests with Retry-After ────────────────────────────────
// The backend rate-limits aggressively. Callers need to know the HTTP status
// so they can surface a "please wait" message or schedule a retry.
// Every throwing caller must produce an Error (or ApiError) that includes the
// 429 status; getBackendReady must silently return false.
describe('failure mode: 429 with Retry-After', () => {
  afterEach(() => vi.unstubAllGlobals());

  function rateLimitedResponse() {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': '30',
      },
    });
  }

  it('getNgos rejects and the error message includes 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(getNgos()).rejects.toThrow(/429/);
  });

  it('getNgo rejects and the error message includes 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(getNgo('ngo-1')).rejects.toThrow(/429/);
  });

  it('lookupNgoByAddress rejects and the error message includes 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(lookupNgoByAddress('GABC')).rejects.toThrow(/429/);
  });

  it('getStreams rejects and the error message includes 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow(/429/);
  });

  it('getWithdrawals rejects and the error message includes 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(getWithdrawals('ngo-1')).rejects.toThrow(/429/);
  });

  it('submitNgoApplication throws ApiError with status 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    const err = await submitNgoApplication({
      ownerAddress: 'GABC',
      name: 'T',
      description: 'D',
      contactEmail: 'a@b.com',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(429);
  });

  it('getApplicationStatus rejects and the error message includes 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(getApplicationStatus('GABC')).rejects.toThrow(/429/);
  });

  it('getBackendReady returns false (does not throw) on a 429', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(rateLimitedResponse())));
    await expect(getBackendReady()).resolves.toBe(false);
  });
});

// ── 3. 5xx with an HTML body ─────────────────────────────────────────────────
// A proxy, CDN, or crash dumps HTML. The body is not JSON. Callers still need
// an Error that includes the HTTP status so they can distinguish server errors
// from network errors.
describe('failure mode: 5xx with HTML body', () => {
  afterEach(() => vi.unstubAllGlobals());

  function htmlErrorResponse(status = 502) {
    return new Response(
      '<!DOCTYPE html><html><body><h1>Bad Gateway</h1></body></html>',
      {
        status,
        headers: { 'content-type': 'text/html' },
      },
    );
  }

  it('getNgos rejects with an error that includes the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(502))));
    await expect(getNgos()).rejects.toThrow(/502/);
  });

  it('getNgo rejects with an error that includes the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(503))));
    await expect(getNgo('ngo-1')).rejects.toThrow(/503/);
  });

  it('lookupNgoByAddress rejects with an error that includes the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(500))));
    await expect(lookupNgoByAddress('GABC')).rejects.toThrow(/500/);
  });

  it('getStreams rejects with an error that includes the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(503))));
    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow(/503/);
  });

  it('getWithdrawals rejects with an error that includes the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(500))));
    await expect(getWithdrawals('ngo-1')).rejects.toThrow(/500/);
  });

  it('submitNgoApplication throws ApiError with the 5xx status and falls back gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(500))));
    const err = await submitNgoApplication({
      ownerAddress: 'GABC',
      name: 'T',
      description: 'D',
      contactEmail: 'a@b.com',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    // The HTML body is not JSON; readErrorMessage must fall back to the
    // default message rather than throwing a secondary parse error.
    expect((err as ApiError).message).toBeTruthy();
  });

  it('getBackendReady returns false (does not throw) on a 5xx with an HTML body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(htmlErrorResponse(503))));
    await expect(getBackendReady()).resolves.toBe(false);
  });
});

// ── 4. 200 with invalid JSON ─────────────────────────────────────────────────
// A proxy cache or feature flag system can respond 200 with a maintenance
// page. Callers must receive a rejected promise rather than a parse error
// that surfaces as an unhandled rejection.
describe('failure mode: 200 with invalid JSON', () => {
  afterEach(() => vi.unstubAllGlobals());

  function invalidJsonResponse() {
    return new Response('<!DOCTYPE html><html><body>Maintenance</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  }

  it('getNgos rejects when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    await expect(getNgos()).rejects.toThrow();
  });

  it('getNgo rejects when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    await expect(getNgo('ngo-1')).rejects.toThrow();
  });

  it('lookupNgoByAddress rejects when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    await expect(lookupNgoByAddress('GABC')).rejects.toThrow();
  });

  it('getStreams rejects when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow();
  });

  it('getWithdrawals rejects when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    await expect(getWithdrawals('ngo-1')).rejects.toThrow();
  });

  it('getBackendReady returns false (never rejects) when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    // getBackendReady wraps everything in try/catch — it must absorb the
    // JSON parse error rather than propagating it.
    await expect(getBackendReady()).resolves.toBe(false);
  });

  it('getApplicationStatus rejects when the 200 body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(invalidJsonResponse())));
    await expect(getApplicationStatus('GABC')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getBackendReady
// ---------------------------------------------------------------------------

describe('getBackendReady', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the root-level readiness endpoint, not a /v1 route', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ status: 'ok', lag: 0 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBackendReady()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/health\/ready$/);
    expect(fetchMock.mock.calls[0][0]).not.toContain('/v1/');
  });

  it('forwards a caller-supplied signal so polling can cancel the request', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ status: 'ok' })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getBackendReady(controller.signal);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const combined = init.signal as AbortSignal;
    expect(combined).toBeInstanceOf(AbortSignal);
    expect(combined.aborted).toBe(false);
    controller.abort();
    expect(combined.aborted).toBe(true);
  });

  it('returns false when the backend reports itself unavailable with 503', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ status: 'error', reason: 'service_unavailable' }, 503)),
    ));

    await expect(getBackendReady()).resolves.toBe(false);
  });

  it('returns false for a 200 response that does not report status ok', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse({ status: 'degraded' })),
    ));

    await expect(getBackendReady()).resolves.toBe(false);
  });

  it('returns false for a non-JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('not json', { status: 200 })),
    ));

    await expect(getBackendReady()).resolves.toBe(false);
  });

  it('returns false when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw networkFailure;
    }));

    await expect(getBackendReady()).resolves.toBe(false);
  });
});
