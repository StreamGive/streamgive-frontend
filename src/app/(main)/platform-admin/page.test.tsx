import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PlatformAdminPage from './page';

const ADMIN_ADDRESS = 'G' + 'A'.repeat(55);
const signMessage = vi.fn();

const APPLICATION = {
  id: 'app-1',
  ownerAddress: 'G' + 'N'.repeat(55),
  name: 'Test NGO',
  description: 'A test NGO.',
  website: null,
  contactEmail: 'ngo@example.com',
  country: null,
  status: 'PENDING' as const,
  reviewNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const VERIFIED_NGO = {
  id: 'ngo-1',
  ownerAddress: 'G' + 'V'.repeat(55),
  name: 'Verified NGO',
  verified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const {
  listNgoApplications,
  reviewNgoApplication,
  getNgos,
  showToast,
  approveNgoMock,
  revokeNgoMock,
} = vi.hoisted(() => ({
  listNgoApplications: vi.fn(),
  reviewNgoApplication: vi.fn(),
  getNgos: vi.fn(),
  showToast: vi.fn(),
  approveNgoMock: vi.fn(),
  revokeNgoMock: vi.fn(),
}));

vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({ address: ADMIN_ADDRESS, signMessage, signTransaction: vi.fn() }),
}));

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('@/lib/ngoRegistryClient', () => ({
  useNgoRegistryClient: () => ({
    client: {
      approve_ngo: approveNgoMock,
      revoke_ngo: revokeNgoMock,
    },
    ready: true,
    initError: null,
    retryInit: vi.fn(),
  }),
}));

vi.mock('@/lib/adminApi', () => ({ listNgoApplications, reviewNgoApplication }));
vi.mock('@/lib/api', () => ({ getNgos }));

describe('PlatformAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNgos.mockResolvedValue([]);
    listNgoApplications.mockResolvedValue({ applications: [], total: 0, limit: 100, offset: 0 });
  });

  describe('approve flow', () => {
    it('approves an application on-chain and off-chain, shows success toast, and refreshes', async () => {
      listNgoApplications.mockResolvedValueOnce({ applications: [APPLICATION], total: 1, limit: 100, offset: 0 }).mockResolvedValueOnce({ applications: [], total: 0, limit: 100, offset: 0 });
      const signAndSend = vi.fn().mockResolvedValue({});
      approveNgoMock.mockResolvedValue({ signAndSend, built: { fee: '100' } });
      reviewNgoApplication.mockResolvedValue({});

      const user = userEvent.setup();
      render(<PlatformAdminPage />);

      const approveButton = await screen.findByRole('button', { name: 'Approve' });
      await user.click(approveButton);

      // First click only builds the tx (for the fee estimate) and shows the
      // confirm panel — nothing is signed yet.
      expect(approveNgoMock).toHaveBeenCalledWith({ ngo_owner: APPLICATION.ownerAddress });
      expect(signAndSend).not.toHaveBeenCalled();

      const confirmButton = await screen.findByRole('button', { name: 'Yes, approve' });
      await user.click(confirmButton);

      expect(signAndSend).toHaveBeenCalled();
      expect(reviewNgoApplication).toHaveBeenCalledWith(
        ADMIN_ADDRESS,
        signMessage,
        APPLICATION.id,
        'approve',
        undefined,
      );
      expect(showToast).toHaveBeenCalledWith('success', 'Test NGO approved.');
      expect(listNgoApplications).toHaveBeenCalledTimes(2);
    });

    it('shows error toast when on-chain approval fails and skips off-chain review', async () => {
      listNgoApplications.mockResolvedValueOnce({ applications: [APPLICATION], total: 1, limit: 100, offset: 0 });
      approveNgoMock.mockRejectedValue(new Error('On-chain approval rejected'));

      const user = userEvent.setup();
      render(<PlatformAdminPage />);

      const approveButton = await screen.findByRole('button', { name: 'Approve' });
      await user.click(approveButton);

      expect(showToast).toHaveBeenCalledWith('error', 'On-chain approval rejected');
      expect(reviewNgoApplication).not.toHaveBeenCalled();
    });
  });

  describe('reject flow', () => {
    it('asks for confirmation, then calls reviewNgoApplication with reject, shows toast and refreshes', async () => {
      listNgoApplications.mockResolvedValueOnce({ applications: [APPLICATION], total: 1, limit: 100, offset: 0 }).mockResolvedValueOnce({ applications: [], total: 0, limit: 100, offset: 0 });
      const user = userEvent.setup();

      render(<PlatformAdminPage />);

      await user.click(await screen.findByRole('button', { name: 'Reject' }));
      expect(reviewNgoApplication).not.toHaveBeenCalled();

      await user.click(await screen.findByRole('button', { name: 'Yes, reject' }));

      expect(reviewNgoApplication).toHaveBeenCalledWith(
        ADMIN_ADDRESS,
        signMessage,
        APPLICATION.id,
        'reject',
        undefined,
      );
      expect(showToast).toHaveBeenCalledWith('info', 'Test NGO rejected.');
      expect(await screen.findByText('No pending applications.')).toBeInTheDocument();
      expect(listNgoApplications).toHaveBeenCalledTimes(2);
    });

    it('cancels rejection when clicking Never mind', async () => {
      listNgoApplications.mockResolvedValueOnce({ applications: [APPLICATION], total: 1, limit: 100, offset: 0 });
      const user = userEvent.setup();

      render(<PlatformAdminPage />);

      await user.click(await screen.findByRole('button', { name: 'Reject' }));
      expect(screen.getByText('Reject this application?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Never mind' }));
      expect(screen.queryByText('Reject this application?')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
      expect(reviewNgoApplication).not.toHaveBeenCalled();
    });

    it('shows error toast when reject review fails', async () => {
      listNgoApplications.mockResolvedValueOnce({ applications: [APPLICATION], total: 1, limit: 100, offset: 0 });
      reviewNgoApplication.mockRejectedValue(new Error('API reject failed'));

      const user = userEvent.setup();
      render(<PlatformAdminPage />);

      await user.click(await screen.findByRole('button', { name: 'Reject' }));
      await user.click(await screen.findByRole('button', { name: 'Yes, reject' }));

      expect(showToast).toHaveBeenCalledWith('error', 'API reject failed');
    });
  });

  describe('revoke flow', () => {
    it('asks for confirmation, revokes verified NGO on-chain, shows success toast and refreshes', async () => {
      getNgos.mockResolvedValueOnce([VERIFIED_NGO]).mockResolvedValueOnce([]);
      const signAndSend = vi.fn().mockResolvedValue({});
      revokeNgoMock.mockResolvedValue({ signAndSend });

      const user = userEvent.setup();
      render(<PlatformAdminPage />);

      const revokeButton = await screen.findByRole('button', { name: 'Revoke' });
      await user.click(revokeButton);

      expect(screen.getByRole('button', { name: 'Confirm Revoke' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

      expect(revokeNgoMock).toHaveBeenCalledWith({ ngo_owner: VERIFIED_NGO.ownerAddress });
      expect(signAndSend).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('success', 'Verified NGO revoked.');
      expect(getNgos).toHaveBeenCalledTimes(2);
    });

    it('cancels revocation when clicking Cancel', async () => {
      getNgos.mockResolvedValueOnce([VERIFIED_NGO]);
      const user = userEvent.setup();

      render(<PlatformAdminPage />);

      const revokeButton = await screen.findByRole('button', { name: 'Revoke' });
      await user.click(revokeButton);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
      expect(revokeNgoMock).not.toHaveBeenCalled();
    });

    it('shows error toast when on-chain revoke fails', async () => {
      getNgos.mockResolvedValueOnce([VERIFIED_NGO]);
      revokeNgoMock.mockRejectedValue(new Error('Revoke transaction failed'));

      const user = userEvent.setup();
      render(<PlatformAdminPage />);

      await user.click(await screen.findByRole('button', { name: 'Revoke' }));
      await user.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

      expect(showToast).toHaveBeenCalledWith('error', 'Revoke transaction failed');
    });
  });

  describe('status tabs navigation', () => {
    it('renders the right rows when switching between Pending, Approved, and Rejected tabs', async () => {
      const approvedApp = { ...APPLICATION, id: 'app-2', name: 'Approved NGO', status: 'APPROVED' as const };
      const rejectedApp = { ...APPLICATION, id: 'app-3', name: 'Rejected NGO', status: 'REJECTED' as const };

      listNgoApplications
        .mockResolvedValueOnce([APPLICATION]) // Initial PENDING load
        .mockResolvedValueOnce([approvedApp]) // After clicking Approved
        .mockResolvedValueOnce([rejectedApp]) // After clicking Rejected
        .mockResolvedValueOnce([APPLICATION]); // After clicking Pending again

      const user = userEvent.setup();
      render(<PlatformAdminPage />);

      // Initial pending load
      expect(await screen.findByText('Test NGO')).toBeInTheDocument();
      expect(listNgoApplications).toHaveBeenLastCalledWith(ADMIN_ADDRESS, signMessage, 'PENDING');

      // Click Approved tab
      await user.click(screen.getByRole('tab', { name: 'Approved' }));
      expect(await screen.findByText('Approved NGO')).toBeInTheDocument();
      expect(listNgoApplications).toHaveBeenLastCalledWith(ADMIN_ADDRESS, signMessage, 'APPROVED');

      // Click Rejected tab
      await user.click(screen.getByRole('tab', { name: 'Rejected' }));
      expect(await screen.findByText('Rejected NGO')).toBeInTheDocument();
      expect(listNgoApplications).toHaveBeenLastCalledWith(ADMIN_ADDRESS, signMessage, 'REJECTED');

      // Click Pending tab again
      await user.click(screen.getByRole('tab', { name: 'Pending' }));
      expect(await screen.findByText('Test NGO')).toBeInTheDocument();
      expect(listNgoApplications).toHaveBeenLastCalledWith(ADMIN_ADDRESS, signMessage, 'PENDING');
    });
  });
});
