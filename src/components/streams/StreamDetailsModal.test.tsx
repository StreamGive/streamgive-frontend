import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Stream } from '@/lib/api';

import { StreamDetailsModal } from './StreamDetailsModal';

vi.mock('@/lib/stellar', () => ({
  explorerUrl: vi.fn((type, id) => `https://stellar.expert/${type}/${id}`),
  getNativeAssetAddress: vi.fn(() => 'NATIVE_ASSET_ID'),
  getUsdcAssetAddress: vi.fn(() => 'USDC_ASSET_ID'),
  DONATION_VAULT_CONTRACT_ID: 'CVAULTCONTRACT',
}));

const MOCK_STREAM: Stream = {
  id: 'stream-1',
  onChainId: '1',
  tokenAddress: 'CCONTRACTADDRESS',
  rate: '10',
  balance: '1000',
  withdrawn: '0',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  donor: { address: 'GDONOR' },
  ngo: { id: 'ngo-1', name: 'Test NGO', ownerAddress: 'GNGO' },
};

describe('StreamDetailsModal', () => {
  it('renders the native asset as "XLM"', () => {
    const nativeStream = { ...MOCK_STREAM, tokenAddress: 'NATIVE_ASSET_ID' };
    render(<StreamDetailsModal stream={nativeStream} onClose={vi.fn()} />);
    
    expect(screen.getByText('XLM')).toBeInTheDocument();
  });

  it('renders a non-native token as its raw contract address', () => {
    render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);
    
    expect(screen.getByText('CCONTRACTADDRESS')).toBeInTheDocument();
  });

  it('links "View contract" to the donation-vault address on stellar.expert', () => {
    render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'View contract' })).toHaveAttribute(
      'href',
      'https://stellar.expert/contract/CVAULTCONTRACT',
    );
  });

  it('calls onClose when clicking the modal backdrop', () => {
    const onClose = vi.fn();
    render(<StreamDetailsModal stream={MOCK_STREAM} onClose={onClose} />);
    
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement!;
    
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the explicit close button', () => {
    const onClose = vi.fn();
    render(<StreamDetailsModal stream={MOCK_STREAM} onClose={onClose} />);
    
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the dialog content itself', () => {
    const onClose = vi.fn();
    render(<StreamDetailsModal stream={MOCK_STREAM} onClose={onClose} />);
    
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('keyboard behaviour', () => {
    function OpenerHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open details
          </button>
          {open && <StreamDetailsModal stream={MOCK_STREAM} onClose={() => setOpen(false)} />}
        </>
      );
    }

    it('moves focus to the close button when it opens', () => {
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);

      expect(screen.getByLabelText('Close')).toHaveFocus();
    });

    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for other keys', () => {
      const onClose = vi.fn();
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'a' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('stops listening for Escape once it unmounts', () => {
      const onClose = vi.fn();
      const { unmount } = render(<StreamDetailsModal stream={MOCK_STREAM} onClose={onClose} />);

      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('wraps Tab from the last focusable element back to the first', () => {
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);
      const closeButton = screen.getByLabelText('Close');
      // The on-chain ID's CopyAddressButton is the last focusable element —
      // it comes after "View contract" in the dialog's own tab order.
      const lastControl = screen.getByRole('button', { name: `Copy address ${MOCK_STREAM.onChainId}` });
      lastControl.focus();

      const notPrevented = fireEvent.keyDown(document, { key: 'Tab' });

      expect(closeButton).toHaveFocus();
      expect(notPrevented).toBe(false);
    });

    it('wraps Shift+Tab from the first focusable element to the last', () => {
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);
      const closeButton = screen.getByLabelText('Close');
      const lastControl = screen.getByRole('button', { name: `Copy address ${MOCK_STREAM.onChainId}` });
      expect(closeButton).toHaveFocus();

      const notPrevented = fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      expect(lastControl).toHaveFocus();
      expect(notPrevented).toBe(false);
    });

    it('leaves Tab alone while focus is in the middle of the dialog', () => {
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);
      screen.getByRole('link', { name: 'Test NGO' }).focus();

      const forward = fireEvent.keyDown(document, { key: 'Tab' });
      const backward = fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      // Not prevented: the browser moves focus, and it stays inside the dialog.
      expect(forward).toBe(true);
      expect(backward).toBe(true);
      expect(screen.getByRole('link', { name: 'Test NGO' })).toHaveFocus();
    });

    it('keeps focus inside the dialog across a full Tab cycle', async () => {
      const user = userEvent.setup();
      render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);
      const dialog = screen.getByRole('dialog');
      const focusableCount = dialog.querySelectorAll('a[href], button').length;

      for (let i = 0; i < focusableCount * 2; i += 1) {
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
      }
      for (let i = 0; i < focusableCount * 2; i += 1) {
        await user.tab({ shift: true });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
      }
    });

    it('locks body scroll while open and restores it on close', () => {
      document.body.style.overflow = 'scroll';
      const { unmount } = render(<StreamDetailsModal stream={MOCK_STREAM} onClose={vi.fn()} />);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('scroll');
      document.body.style.overflow = '';
    });

    it('returns focus to the opener when closed with Escape', async () => {
      const user = userEvent.setup();
      render(<OpenerHarness />);
      const opener = screen.getByRole('button', { name: 'Open details' });

      await user.click(opener);
      expect(screen.getByLabelText('Close')).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });

    it('returns focus to the opener when closed with the close button', async () => {
      const user = userEvent.setup();
      render(<OpenerHarness />);
      const opener = screen.getByRole('button', { name: 'Open details' });

      await user.click(opener);
      await user.click(screen.getByLabelText('Close'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });
});
