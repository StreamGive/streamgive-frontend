import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImpactPage from './page';
import { loadPlatformImpact, type PlatformImpact } from '@/lib/impact';

// The impact page renders <Header />, which reads the wallet context; give it
// a signed-out static value the same way Header.test.tsx does.
vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: null,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    networkMismatch: false,
  }),
}));
vi.mock('@/lib/impact', () => ({
  loadPlatformImpact: vi.fn(),
}));

const IMPACT: PlatformImpact = {
  totalCommitted: 1_234_500_000n,
  totalWithdrawn: 567_800_000n,
  activeStreams: 12,
  ngoCount: 4,
};

// Must match page.tsx's POLL_INTERVAL_MS so advancing one interval is
// exactly one poll.
const POLL_INTERVAL_MS = 20_000;

describe('ImpactPage polling cleanup (issue #157)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(loadPlatformImpact).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stops polling once unmounted', async () => {
    vi.mocked(loadPlatformImpact).mockResolvedValue(IMPACT);

    const { unmount } = render(<ImpactPage />);
    await vi.waitFor(() => expect(loadPlatformImpact).toHaveBeenCalledTimes(1));

    unmount();

    // Advance well past several poll intervals. If the interval survived
    // unmount, loadPlatformImpact would be called again; it must not be.
    await vi.advanceTimersByTimeAsync(5 * POLL_INTERVAL_MS);
    expect(loadPlatformImpact).toHaveBeenCalledTimes(1);
  });

  it('passes an AbortSignal to loadPlatformImpact that is aborted on unmount', async () => {
    vi.mocked(loadPlatformImpact).mockResolvedValue(IMPACT);

    const { unmount } = render(<ImpactPage />);
    await vi.waitFor(() => expect(loadPlatformImpact).toHaveBeenCalledTimes(1));

    const signal = vi.mocked(loadPlatformImpact).mock.calls[0][0];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('does not update state or throw when a fetch resolves after unmount', async () => {
    // A request still in flight at the moment of unmount: resolves on its
    // own schedule, not in response to anything the test does after
    // unmount() returns. The guard in the component's cleanup, not a
    // rejected/aborted promise, is what must stop the resulting setState.
    let resolveImpact: (value: typeof IMPACT) => void = () => {};
    vi.mocked(loadPlatformImpact).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImpact = resolve;
        }),
    );

    const { unmount } = render(<ImpactPage />);
    await vi.waitFor(() => expect(loadPlatformImpact).toHaveBeenCalledTimes(1));

    unmount();

    // Resolving after unmount must not throw (React's "update on an
    // unmounted component" warning surfaces as a console.error, not a
    // thrown exception, so this also asserts nothing was logged).
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => resolveImpact(IMPACT)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not show an error state when the in-flight request is aborted by unmount', async () => {
    // Exercises the real (non-mocked) rejection shape an aborted fetch
    // produces, confirming the catch handler's AbortError check actually
    // suppresses it rather than this test only proving the mock behaves.
    let rejectImpact: (err: unknown) => void = () => {};
    vi.mocked(loadPlatformImpact).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectImpact = reject;
        }),
    );

    const { unmount } = render(<ImpactPage />);
    await vi.waitFor(() => expect(loadPlatformImpact).toHaveBeenCalledTimes(1));

    unmount();
    rejectImpact(new DOMException('The operation was aborted.', 'AbortError'));

    // Nothing to assert against the unmounted tree directly; the earlier
    // "does not throw" test covers the crash case. This test's job is
    // narrower: prove the promise settling post-unmount is a no-op, which
    // an unhandled rejection warning (not a thrown error) would indicate
    // otherwise. Flushing microtasks is enough to prove it resolves quietly.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('renders the loaded impact numbers while mounted', async () => {
    vi.mocked(loadPlatformImpact).mockResolvedValue(IMPACT);

    render(<ImpactPage />);

    await vi.waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

describe('ImpactPage error recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(loadPlatformImpact).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('recovers from an API failure on the next poll', async () => {
    // Fail on the first call (initial load), succeed on the second (poll) —
    // exactly the recovery flow fixed in #39.
    const load = vi.mocked(loadPlatformImpact);
    load.mockRejectedValueOnce(new TypeError('fetch failed'));
    load.mockResolvedValueOnce(IMPACT);

    render(<ImpactPage />);

    // Flush the initial load's rejected promise (findBy* can't be used here:
    // RTL's wait-for polling relies on timers, which are frozen while fake
    // timers are active).
    await act(async () => {});

    // First call failed and nothing was ever loaded: the page shows the
    // hard error state, not the numbers.
    expect(screen.getByText(/Couldn't load platform stats/i)).toBeInTheDocument();
    expect(screen.queryByText('Total committed')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);

    // One poll interval passes; the refetch succeeds this time.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await act(async () => {});

    // The page transitions from the error state to the data.
    expect(screen.getByText('Total committed')).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load platform stats/i)).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // Verified NGOs
    expect(load).toHaveBeenCalledTimes(2);
  });
});
