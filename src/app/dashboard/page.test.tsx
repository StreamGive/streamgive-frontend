import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DashboardPage from './page';
import * as WalletProviderMod from '@/components/wallet/WalletProvider';
import * as ApiMod from '@/lib/api';
import type { Stream } from '@/lib/api';

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

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getStreams: vi.fn(),
}));

vi.mock('@/lib/csv', () => ({
  buildDonationHistoryCsv: vi.fn(),
}));

describe('DashboardPage', () => {
  it('shows empty state when donor has no streams', async () => {
    vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
      address: 'G123',
      connecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
    });

    vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/you haven't started any streams yet/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /explore ngos/i })).toHaveAttribute('href', '/ngos');
    });
  });

  describe('stream ID search', () => {
    // Cancelled so StreamControls (which needs a ToastProvider/contract
    // client this test file doesn't set up) never renders — irrelevant
    // to search, which only cares about onChainId.
    const streamOne = makeStream({ id: 's1', onChainId: '101', status: 'CANCELLED' });
    const streamTwo = makeStream({ id: 's2', onChainId: '202', status: 'CANCELLED' });

    it('filters the list by on-chain stream ID', async () => {
      vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
        address: 'G123',
        connecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
      });
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
      vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
        address: 'G123',
        connecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
      });
      vi.spyOn(ApiMod, 'getStreams').mockResolvedValue([streamOne, streamTwo]);

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => expect(screen.getAllByText('Test NGO')).toHaveLength(2));
      await user.type(screen.getByPlaceholderText('Search by stream ID…'), '999');

      expect(await screen.findByText('No streams match stream ID "999".')).toBeInTheDocument();
    });
  });

  describe('background polling', () => {
    function mockConnectedWallet() {
      vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
        address: 'G123',
        connecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
      });
    }

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
});
