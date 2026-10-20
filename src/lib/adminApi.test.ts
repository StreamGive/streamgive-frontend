import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ADDRESS = 'GA4Z4GPSO3FKPMQJ3WCMU5D5WE25SDXZS47YDF3J3NWF65ILGCVJVWIJ';

/**
 * The signature cache lives at module scope, so it would otherwise carry
 * across tests and make each one depend on the order it ran in. Re-importing
 * per test gives every case its own empty cache.
 */
async function freshAdminApi() {
  vi.resetModules();
  return import('./adminApi');
}

function okResponse() {
  return new Response(JSON.stringify({ applications: [], total: 0, limit: 100, offset: 0 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
}

describe('admin request signing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('signs once and reuses that signature for repeat calls in the window', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('c2ln');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse())),
    );

    await listNgoApplications(ADDRESS, signMessage, 'PENDING');
    await listNgoApplications(ADDRESS, signMessage, 'PENDING');
    await listNgoApplications(ADDRESS, signMessage, 'PENDING');

    // Three requests, one wallet prompt — this is the whole point.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it('re-signs once the reuse window has passed', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('c2ln');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse())),
    );

    await listNgoApplications(ADDRESS, signMessage, 'PENDING');
    vi.advanceTimersByTime(5 * 60 * 1000);
    await listNgoApplications(ADDRESS, signMessage, 'PENDING');

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it('signs separately per path, so one signature cannot be aimed elsewhere', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('c2ln');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse())),
    );

    await listNgoApplications(ADDRESS, signMessage, 'PENDING');
    await listNgoApplications(ADDRESS, signMessage, 'APPROVED');

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it('retries once with a fresh signature when a reused one is rejected', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('c2ln');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse()) // signs, succeeds
      .mockResolvedValueOnce(unauthorized()) // reuses, server rejects it
      .mockResolvedValueOnce(okResponse()); // retry with a fresh signature
    vi.stubGlobal('fetch', fetchMock);

    await listNgoApplications(ADDRESS, signMessage, 'PENDING');
    await expect(listNgoApplications(ADDRESS, signMessage, 'PENDING')).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it('does not re-prompt when a freshly signed request is rejected', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('c2ln');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(unauthorized())),
    );

    // The wrong wallet is connected. Signing again would just produce another
    // signature from the same wrong key, so it must not ask a second time.
    await expect(listNgoApplications(ADDRESS, signMessage, 'PENDING')).rejects.toThrow(/401/);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });
});

describe('listNgoApplications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the applications array from the paginated envelope', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');

    const application = {
      id: 'app-1',
      ownerAddress: ADDRESS,
      name: 'Test NGO',
      description: 'Desc',
      website: null,
      contactEmail: 'test@example.com',
      country: null,
      status: 'PENDING' as const,
      reviewNote: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ applications: [application], total: 1, limit: 100, offset: 0 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );

    const result = await listNgoApplications(ADDRESS, signMessage);
    expect(result.applications).toEqual([application]);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.offset).toBe(0);
  });

  it('passes offset as a query param when provided', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ applications: [], total: 50, limit: 20, offset: 20 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listNgoApplications(ADDRESS, signMessage, 'PENDING', 20);

    const calledUrl = (fetchMock.mock.calls[0][0] as string);
    expect(calledUrl).toContain('offset=20');
    expect(result.total).toBe(50);
    expect(result.offset).toBe(20);
  });

  it('omits offset query param when offset is 0', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ applications: [], total: 0, limit: 100, offset: 0 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listNgoApplications(ADDRESS, signMessage, 'PENDING', 0);

    const calledUrl = (fetchMock.mock.calls[0][0] as string);
    expect(calledUrl).not.toContain('offset=');
  });

  it('includes the status query param when provided', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ applications: [], total: 0, limit: 100, offset: 0 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listNgoApplications(ADDRESS, signMessage, 'APPROVED');

    const calledUrl = (fetchMock.mock.calls[0][0] as string);
    expect(calledUrl).toContain('status=APPROVED');
  });

  it('omits the status query param when not provided', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ applications: [], total: 0, limit: 100, offset: 0 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listNgoApplications(ADDRESS, signMessage);

    const calledUrl = (fetchMock.mock.calls[0][0] as string);
    expect(calledUrl).not.toContain('status=');
  });

  it('throws when the response body is a bare array instead of an envelope', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    await expect(listNgoApplications(ADDRESS, signMessage)).rejects.toThrow(
      /expected an \{ applications: \[.*\] \} envelope/i,
    );
  });

  it('throws when the response body is missing the applications field', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ total: 0 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    await expect(listNgoApplications(ADDRESS, signMessage)).rejects.toThrow(
      /expected an \{ applications: \[.*\] \} envelope/i,
    );
  });

  it('throws when the response is not ok', async () => {
    const { listNgoApplications } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })),
      ),
    );

    await expect(listNgoApplications(ADDRESS, signMessage)).rejects.toThrow(/403/);
  });
});

describe('reviewNgoApplication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const reviewedApplication = {
    id: 'app-1',
    ownerAddress: ADDRESS,
    name: 'Test NGO',
    description: 'Desc',
    website: null,
    contactEmail: 'test@example.com',
    country: null,
    status: 'APPROVED' as const,
    reviewNote: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };

  it('posts to the correct approve path', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(reviewedApplication), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reviewNgoApplication(ADDRESS, signMessage, 'app-1', 'approve');

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/ngo-applications/app-1/approve');
    expect(calledInit.method).toBe('POST');
  });

  it('posts to the correct reject path', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...reviewedApplication, status: 'REJECTED' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reviewNgoApplication(ADDRESS, signMessage, 'app-1', 'reject');

    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('/ngo-applications/app-1/reject');
  });

  it('includes a trimmed reviewNote in the request body when provided', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(reviewedApplication), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reviewNgoApplication(ADDRESS, signMessage, 'app-1', 'approve', '  Great org  ');

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(calledInit.body as string) as { reviewNote?: string };
    expect(body.reviewNote).toBe('Great org');
  });

  it('omits reviewNote from the request body when not provided', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(reviewedApplication), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reviewNgoApplication(ADDRESS, signMessage, 'app-1', 'approve');

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(calledInit.body as string) as { reviewNote?: string };
    expect(body.reviewNote).toBeUndefined();
  });

  it('omits reviewNote from the request body when an empty string is provided', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(reviewedApplication), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reviewNgoApplication(ADDRESS, signMessage, 'app-1', 'approve', '   ');

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(calledInit.body as string) as { reviewNote?: string };
    expect(body.reviewNote).toBeUndefined();
  });

  it('returns the updated application on success', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(reviewedApplication), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    const result = await reviewNgoApplication(ADDRESS, signMessage, 'app-1', 'approve');
    expect(result).toEqual(reviewedApplication);
  });

  it('throws when the response is not ok', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'not found' }), { status: 404 })),
      ),
    );

    await expect(
      reviewNgoApplication(ADDRESS, signMessage, 'missing-id', 'approve'),
    ).rejects.toThrow(/404/);
  });

  it('URL-encodes the application id in the path', async () => {
    const { reviewNgoApplication } = await freshAdminApi();
    const signMessage = vi.fn().mockResolvedValue('sig');
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(reviewedApplication), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reviewNgoApplication(ADDRESS, signMessage, 'app/with spaces', 'approve');

    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('app%2Fwith%20spaces');
  });
});
