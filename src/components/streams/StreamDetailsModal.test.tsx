import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Stream } from '@/lib/api';

import { StreamDetailsModal } from './StreamDetailsModal';

vi.mock('@/lib/stellar', () => ({
  explorerUrl: vi.fn((type, id) => `https://stellar.expert/${type}/${id}`),
  getNativeAssetAddress: vi.fn(() => 'NATIVE_ASSET_ID'),
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
});
