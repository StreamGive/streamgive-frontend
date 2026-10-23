import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from './page';
import * as WalletProviderMod from '@/components/wallet/WalletProvider';
import * as ApiMod from '@/lib/api';
import * as CsvMod from '@/lib/csv';
import type { Stream } from '@/lib/api';
import { buildDonationHistoryCsv } from '@/lib/csv';

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 'stream-1',
    onChainId: '1',
    tokenAddress: 'CTOKEN',
    rate: '10',
    balance: '1000',
    withdrawn: '0',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    donor: { address: 'G123' },
    ngo: { id: 'ngo-1', name: 'Test NGO', ownerAddress: 'GNGO' },
    ...overrides,
  };
}

vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));
vi.mock('@/components/dashboard/StreamControls', () => ({ StreamControls: () => null }));
vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));


vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getStreams: vi.fn(),
}));

vi.mock('@/lib/csv', () => ({
  buildDonationHistoryCsv: vi.fn(),
}));

vi.mock('@/components/dashboard/StreamControls', () => ({
  StreamControls: () => null,
}));

describe('DashboardPage', () => {
  function mockConnectedWallet() {
    vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
      address: 'G123',
      connecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
      noWalletOptions: null,
      dismissNoWalletPrompt: vi.fn(),
    });
  }

  it('shows empty state when donor has no streams', async () => {
    mockConnectedWallet();

    vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/you haven't started any streams yet/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /explore ngos/i })).toHaveAttribute('href', '/ngos');
    });
  });

  it('does not render the empty state before the first fetch resolves', async () => {
    vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
      address: 'G123',
      connecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
      noWalletOptions: null,
      dismissNoWalletPrompt: vi.fn(),
    });

    let resolveFetch: (streams: Stream[]) => void = () => {};
    vi.spyOn(ApiMod, 'getStreams').mockReturnValue(
      new Promise<Stream[]>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<DashboardPage />);

    expect(screen.getByText(/loading your streams/i)).toBeInTheDocument();
    expect(screen.queryByText(/you haven't started any streams yet/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch([]);
    });

    expect(screen.getByText(/you haven't started any streams yet/i)).toBeInTheDocument();
  });

  it('shows a neutral loading state, not the connect prompt, while the wallet session restores', () => {
    vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
      address: null,
      connecting: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
      noWalletOptions: null,
      dismissNoWalletPrompt: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });

  it('keeps the newest response when an older request settles last', async () => {
    const walletFor = (address: string) => ({
      address,
      connecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
      noWalletOptions: null,
      dismissNoWalletPrompt: vi.fn(),
    });
    const wallet = vi.spyOn(WalletProviderMod, 'useWallet');
    wallet.mockReturnValue(walletFor('GOLD'));

    const resolvers: Record<string, (streams: Stream[]) => void> = {};
    vi.spyOn(ApiMod, 'getStreams').mockImplementation(
      ({ donor }) =>
        new Promise<Stream[]>((resolve) => {
          resolvers[donor as string] = resolve;
        }),
    );

    const { rerender } = render(<DashboardPage />);
    await waitFor(() => expect(resolvers.GOLD).toBeDefined());

    // Switch wallets while the first request is still in flight.
    wallet.mockReturnValue(walletFor('GNEW'));
    rerender(<DashboardPage />);
    await waitFor(() => expect(resolvers.GNEW).toBeDefined());

    // The newer request resolves first, the older one arrives last.
    await act(async () => {
      resolvers.GNEW([
        makeStream({ id: 'new', status: 'CANCELLED', ngo: { id: 'n2', name: 'New NGO', ownerAddress: 'GN' } }),
      ]);
    });
    await act(async () => {
      resolvers.GOLD([
        makeStream({ id: 'old', status: 'CANCELLED', ngo: { id: 'n1', name: 'Old NGO', ownerAddress: 'GO' } }),
      ]);
    });

    expect(screen.getByText('New NGO')).toBeInTheDocument();
    expect(screen.queryByText('Old NGO')).not.toBeInTheDocument();
  });

  describe('stream ID search', () => {
    // Cancelled so StreamControls (which needs a ToastProvider/contract
    // client this test file doesn't set up) never renders — irrelevant
    // to search, which only cares about onChainId.
    const streamOne = makeStream({ id: 's1', onChainId: '101', status: 'CANCELLED' });
    const streamTwo = makeStream({ id: 's2', onChainId: '202', status: 'CANCELLED' });

    it('filters the list by on-chain stream ID', async () => {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([streamOne, streamTwo]);

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByText('Test NGO')).toHaveLength(2));

      const search = screen.getByPlaceholderText('Search by stream ID…');
      await user.type(search, '101');

      expect(screen.getAllByText('Test NGO')).toHaveLength(1);
      expect(screen.queryByText(/no streams match/i)).not.toBeInTheDocument();

      await user.clear(search);

      expect(screen.getAllByText('Test NGO')).toHaveLength(2);
    });

    it('shows a no-match message for a stream ID that does not exist', async () => {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([streamOne, streamTwo]);

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByText('Test NGO')).toHaveLength(2));
      await user.type(screen.getByPlaceholderText('Search by stream ID…'), '999');

      expect(await screen.findByText('No streams match stream ID "999".')).toBeInTheDocument();
    });
  });

  describe('load more', () => {
    // Cancelled so StreamControls (which needs a ToastProvider/contract
    // client this test file doesn't set up) never renders. 25 streams is
    // two full pages (PAGE_SIZE 10) plus a partial third.
    const manyStreams = Array.from({ length: 25 }, (_, i) =>
      makeStream({ id: `s${i + 1}`, onChainId: String(i + 1), status: 'CANCELLED' }),
    );

    function setup() {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue(manyStreams);
      render(<DashboardPage />);
    }


    const rows = () => screen.getAllByRole('button', { name: 'View details' });

    it('shows one page at a time and hides "Load more" once everything is visible', async () => {
      const user = userEvent.setup();
      setup();

      await waitFor(() => expect(rows()).toHaveLength(10));

      await user.click(screen.getByRole('button', { name: 'Load more' }));
      expect(rows()).toHaveLength(20);

      await user.click(screen.getByRole('button', { name: 'Load more' }));
      expect(rows()).toHaveLength(25);
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('derives "Load more" from the filtered list, not the full one', async () => {
      const user = userEvent.setup();
      setup();
      await waitFor(() => expect(rows()).toHaveLength(10));

      // IDs containing "2": 2, 12, 20-25 = 8 matches, under one page, even
      // though 25 streams exist in total.
      await user.type(screen.getByPlaceholderText('Search by stream ID…'), '2');

      expect(rows()).toHaveLength(8);
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('goes back to the first page when the filter or search changes', async () => {
      const user = userEvent.setup();
      setup();
      await waitFor(() => expect(rows()).toHaveLength(10));

      await user.click(screen.getByRole('button', { name: 'Load more' }));
      expect(rows()).toHaveLength(20);
      await user.click(screen.getByRole('tab', { name: 'Cancelled' }));
      expect(rows()).toHaveLength(10);

      await user.click(screen.getByRole('button', { name: 'Load more' }));
      expect(rows()).toHaveLength(20);
      // "1" matches 1, 10-19, 21 = 12 streams: more than one page.
      await user.type(screen.getByPlaceholderText('Search by stream ID…'), '1');
      expect(rows()).toHaveLength(10);
      expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    });
  });

  describe('filter tabs', () => {
    // StreamControls is mocked to null above, so an ACTIVE row is safe to
    // render here.
    const activeStream = makeStream({
      id: 's1',
      onChainId: '101',
      status: 'ACTIVE',
      ngo: { id: 'ngo-1', name: 'Active NGO', ownerAddress: 'G1' },
    });
    const cancelledStream = makeStream({
      id: 's2',
      onChainId: '202',
      status: 'CANCELLED',
      ngo: { id: 'ngo-2', name: 'Cancelled NGO', ownerAddress: 'G2' },
    });

    function setup(streams: Stream[]) {
      vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
        address: 'G123',
        connecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
        networkMismatch: false,
        noWalletOptions: null,
        dismissNoWalletPrompt: vi.fn(),
      });
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue(streams);
      render(<DashboardPage />);
    }

    it('selects the Active tab on first load when there are active streams', async () => {
      setup([activeStream, cancelledStream]);

      expect(await screen.findByText('Active NGO')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByText('Cancelled NGO')).not.toBeInTheDocument();
    });

    it('falls back to the All tab when no stream is active', async () => {
      setup([cancelledStream]);

      expect(await screen.findByText('Cancelled NGO')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    });

    it('shows the right streams for each of the All, Active and Cancelled tabs', async () => {
      const user = userEvent.setup();
      setup([activeStream, cancelledStream]);
      await screen.findByText('Active NGO');

      await user.click(screen.getByRole('tab', { name: 'All' }));
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Active NGO')).toBeInTheDocument();
      expect(screen.getByText('Cancelled NGO')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Cancelled' }));
      expect(screen.getByRole('tab', { name: 'Cancelled' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByText('Active NGO')).not.toBeInTheDocument();
      expect(screen.getByText('Cancelled NGO')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Active' }));
      expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Active NGO')).toBeInTheDocument();
      expect(screen.queryByText('Cancelled NGO')).not.toBeInTheDocument();
    });

    it('shows an empty message when the selected tab has no streams', async () => {
      const user = userEvent.setup();
      setup([activeStream]);
      await screen.findByText('Active NGO');

      await user.click(screen.getByRole('tab', { name: 'Cancelled' }));

      expect(screen.getByText('No cancelled streams found.')).toBeInTheDocument();
    });

    it('reveals the next page on Load more within a tab', async () => {
      const user = userEvent.setup();
      const manyCancelled = Array.from({ length: 12 }, (_, i) =>
        makeStream({ id: `c${i + 1}`, onChainId: String(i + 1), status: 'CANCELLED' }),
      );
      setup([activeStream, ...manyCancelled]);
      await screen.findByText('Active NGO');

      await user.click(screen.getByRole('tab', { name: 'Cancelled' }));
      expect(screen.getAllByRole('button', { name: 'View details' })).toHaveLength(10);

      await user.click(screen.getByRole('button', { name: 'Load more' }));

      expect(screen.getAllByRole('button', { name: 'View details' })).toHaveLength(12);
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });
  });

  describe('export CSV', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it('builds a CSV blob from all streams and downloads it', async () => {
      const streams = [
        makeStream({ id: 's1', onChainId: '101', status: 'ACTIVE' }),
        makeStream({ id: 's2', onChainId: '202', status: 'CANCELLED' }),
      ];
      vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
        address: 'G123',
        connecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
        networkMismatch: false,
        noWalletOptions: null,
        dismissNoWalletPrompt: vi.fn(),
      });
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue(streams);
      vi.mocked(CsvMod.buildDonationHistoryCsv).mockReturnValue('id,status\n101,ACTIVE');

      const createObjectURL = vi.fn(() => 'blob:streamgive-csv');
      const revokeObjectURL = vi.fn();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;

      const downloaded: HTMLAnchorElement[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloaded.push(this);
      });

      const user = userEvent.setup();
      render(<DashboardPage />);
      await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

      // Issue #238: The export covers the currently filtered list (Active by default).
      expect(CsvMod.buildDonationHistoryCsv).toHaveBeenCalledWith([streams[0]]);

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv;charset=utf-8;');
      expect(blob.size).toBe('id,status\n101,ACTIVE'.length);

      expect(downloaded).toHaveLength(1);
      expect(downloaded[0].download).toBe('streamgive-donations.csv');
      expect(downloaded[0].href).toBe('blob:streamgive-csv');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:streamgive-csv');
    });
  });

  describe('background polling', () => {
    it('re-fetches streams every 30 seconds while the tab is visible', async () => {
      vi.useFakeTimers();
      try {
        mockConnectedWallet();
        const getStreamsMock = vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([]);

        render(<DashboardPage />);
        await act(async () => {
          await Promise.resolve();
        });
        expect(getStreamsMock).toHaveBeenCalledTimes(1);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(getStreamsMock).toHaveBeenCalledTimes(2);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(getStreamsMock).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops polling while the tab is hidden and catches up immediately once visible again', async () => {
      vi.useFakeTimers();
      try {
        mockConnectedWallet();
        const getStreamsMock = vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([]);

        render(<DashboardPage />);
        await act(async () => {
          await Promise.resolve();
        });
        expect(getStreamsMock).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));

        // The interval is stopped outright (not just skipping a tick), so
        // no amount of elapsed time while hidden triggers another fetch.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(90_000);
        });
        expect(getStreamsMock).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'));
          await Promise.resolve();
        });
        expect(getStreamsMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('sort options', () => {
    const streamOldest = makeStream({
      id: 's1',
      onChainId: '101',
      createdAt: '2026-01-01T00:00:00.000Z',
      balance: '100',
      withdrawn: '0', // committed: 100
      rate: '1', // 100s remaining
      ngo: { id: 'ngo-1', name: 'NGO Jan (Oldest)', ownerAddress: 'G1' },
    });
    const streamMiddle = makeStream({
      id: 's2',
      onChainId: '202',
      createdAt: '2026-02-01T00:00:00.000Z',
      balance: '500',
      withdrawn: '1500', // committed: 2000 (largest)
      rate: '50', // 10s remaining (ending soonest)
      ngo: { id: 'ngo-2', name: 'NGO Feb (Largest & Ending Soonest)', ownerAddress: 'G2' },
    });
    const streamNewest = makeStream({
      id: 's3',
      onChainId: '303',
      createdAt: '2026-03-01T00:00:00.000Z',
      balance: '300',
      withdrawn: '200', // committed: 500
      rate: '2', // 150s remaining
      ngo: { id: 'ngo-3', name: 'NGO Mar (Newest)', ownerAddress: 'G3' },
    });

    function setupStreams() {
      vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
        address: 'G123',
        connecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
        networkMismatch: false,
        noWalletOptions: null,
        dismissNoWalletPrompt: vi.fn(),
      });
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([streamOldest, streamMiddle, streamNewest]);
    }

    it('sorts by newest by default', async () => {
      setupStreams();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByRole('link', { name: /NGO / })).toHaveLength(3));
      const names = screen.getAllByRole('link', { name: /NGO / }).map((el) => el.textContent);
      expect(names).toEqual([
        'NGO Mar (Newest)',
        'NGO Feb (Largest & Ending Soonest)',
        'NGO Jan (Oldest)',
      ]);
    });

    it('sorts by oldest', async () => {
      setupStreams();
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByRole('link', { name: /NGO / })).toHaveLength(3));
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'oldest');

      const names = screen.getAllByRole('link', { name: /NGO / }).map((el) => el.textContent);
      expect(names).toEqual([
        'NGO Jan (Oldest)',
        'NGO Feb (Largest & Ending Soonest)',
        'NGO Mar (Newest)',
      ]);
    });

    it('sorts by largest committed', async () => {
      setupStreams();
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByRole('link', { name: /NGO / })).toHaveLength(3));
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'largest-committed');

      const names = screen.getAllByRole('link', { name: /NGO / }).map((el) => el.textContent);
      expect(names).toEqual([
        'NGO Feb (Largest & Ending Soonest)', // 2000 committed
        'NGO Mar (Newest)', // 500 committed
        'NGO Jan (Oldest)', // 100 committed
      ]);
    });

    it('sorts by ending soonest', async () => {
      setupStreams();
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByRole('link', { name: /NGO / })).toHaveLength(3));
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'ending-soonest');

      const names = screen.getAllByRole('link', { name: /NGO / }).map((el) => el.textContent);
      expect(names).toEqual([
        'NGO Feb (Largest & Ending Soonest)', // 10s remaining
        'NGO Jan (Oldest)', // 100s remaining
        'NGO Mar (Newest)', // 150s remaining
      ]);
    });
  });

  describe('CSV export (#238)', () => {
    const activeStream = makeStream({ id: 's1', onChainId: '101', status: 'ACTIVE' });
    const cancelledStream = makeStream({ id: 's2', onChainId: '202', status: 'CANCELLED' });

    beforeEach(() => {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      window.URL.revokeObjectURL = vi.fn();
    });

    it('exports only active streams when Active filter is selected', async () => {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([activeStream, cancelledStream]);

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByText('Test NGO')).toHaveLength(1));

      // Active filter is selected by default when active streams exist
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(buildDonationHistoryCsv).toHaveBeenCalledWith([activeStream]);
    });

    it('exports all streams when All filter is selected', async () => {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([activeStream, cancelledStream]);

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByText('Test NGO')).toHaveLength(1));

      await user.click(screen.getByRole('tab', { name: 'All' }));
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(buildDonationHistoryCsv).toHaveBeenCalledWith([activeStream, cancelledStream]);
    });

    it('exports only search-matching streams when searching by stream ID', async () => {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([activeStream, cancelledStream]);

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByText('Test NGO')).toHaveLength(1));

      await user.click(screen.getByRole('tab', { name: 'All' }));
      const search = screen.getByPlaceholderText('Search by stream ID…');
      await user.type(search, '202');

      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(buildDonationHistoryCsv).toHaveBeenCalledWith([cancelledStream]);
    });
  });

  describe('load error banner', () => {
    it('shows a retry banner when the initial fetch fails, and clears it on a successful retry', async () => {
      mockConnectedWallet();
      const getStreamsMock = vi.spyOn(ApiMod, 'getStreams');
      getStreamsMock.mockRejectedValueOnce(new Error('network down'));

      const user = userEvent.setup();
      render(<DashboardPage />);

      expect(await screen.findByText(/couldn't load your streams/i)).toBeInTheDocument();
      const retry = screen.getByRole('button', { name: 'Retry' });

      getStreamsMock.mockResolvedValueOnce([
        makeStream({ status: 'CANCELLED', ngo: { id: 'ngo-9', name: 'Recovered NGO', ownerAddress: 'G9' } }),
      ]);
      await user.click(retry);

      await waitFor(() => {
        expect(screen.queryByText(/couldn't load your streams/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText('Recovered NGO')).toBeInTheDocument();
    });
  });

  describe('live balance', () => {
    const liveBalanceAmount = () =>
      screen.getByTitle('Estimated current balance based on stream rate').textContent?.split(' ')[0];

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ticks the estimated balance down every second based on the rate, and floors at zero', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([
        makeStream({
          status: 'ACTIVE',
          balance: '10000000', // formats to "1"
          rate: '1000000', // 0.1/sec
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ]);

      render(<DashboardPage />);
      await act(async () => {
        await Promise.resolve();
      });

      // No time has passed yet relative to `updatedAt`.
      expect(liveBalanceAmount()).toBe('1');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(liveBalanceAmount()).toBe('0.9');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(liveBalanceAmount()).toBe('0.7');

      // 10s in, the balance is fully depleted (10,000,000 - 1,000,000*10 = 0).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7000);
      });
      expect(liveBalanceAmount()).toBe('0');

      // Past depletion the raw formula goes negative — it must floor at
      // zero rather than show that, or tick any further.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(liveBalanceAmount()).toBe('0');
    });

    it('shows the static balance with no live estimate for a non-active stream', async () => {
      mockConnectedWallet();
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([
        makeStream({ status: 'CANCELLED', balance: '10000000' }),
      ]);

      render(<DashboardPage />);

      await waitFor(() => expect(screen.getByText('Test NGO')).toBeInTheDocument());
      expect(
        screen.queryByTitle('Estimated current balance based on stream rate'),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Balance 1 /)).toBeInTheDocument();
    });
  });
});

