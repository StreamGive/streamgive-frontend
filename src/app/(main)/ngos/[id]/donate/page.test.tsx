import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type NgoProfile } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getNgo: vi.fn(),
}));

// Stub layout components so tests stay focused on page logic.
vi.mock('@/components/layout/Header', () => ({ Header: () => null }));
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }));
vi.mock('@/components/donate/CreateStreamForm', () => ({
  CreateStreamForm: () => <div data-testid="stream-form" />,
}));

import { getNgo } from '@/lib/api';
import DonatePage from './page';

const baseNgo: NgoProfile = {
  id: 'ngo-1',
  name: 'Test NGO',
  ownerAddress: 'G' + 'A'.repeat(55),
  verified: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  website: null,
  description: null,
  country: null,
  stats: { totalCommitted: '0', totalWithdrawn: '0', activeStreamCount: 0, donorCount: 0 },
};

async function renderPage(ngo: NgoProfile) {
  vi.mocked(getNgo).mockResolvedValue(ngo);
  const params = Promise.resolve({ id: ngo.id });
  const jsx = await DonatePage({ params });
  render(jsx as React.ReactElement);
}

describe('DonatePage', () => {
  it('shows the stream form for a verified NGO', async () => {
    await renderPage({ ...baseNgo, verified: true });
    expect(screen.getByTestId('stream-form')).toBeInTheDocument();
    expect(screen.queryByText(/not yet verified/i)).not.toBeInTheDocument();
  });

  it('shows a not-verified message instead of the form for an unverified NGO', async () => {
    await renderPage({ ...baseNgo, verified: false });
    expect(screen.getByText(/not yet verified/i)).toBeInTheDocument();
    expect(screen.queryByTestId('stream-form')).not.toBeInTheDocument();
  });
});
