import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NgoExplorer } from './NgoExplorer';
import type { NgoProfile } from '@/lib/api';

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/ngos',
  useSearchParams: () => mockSearchParams,
}));

function makeNgo(overrides: Partial<NgoProfile>): NgoProfile {
  return {
    id: overrides.id ?? 'ngo-1',
    ownerAddress: 'GABC',
    name: overrides.name ?? 'NGO',
    verified: false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stats: {
      totalCommitted: '0',
      totalWithdrawn: '0',
      activeStreamCount: 0,
      donorCount: 0,
      ...overrides.stats,
    },
    ...overrides,
  };
}

// 20 NGOs: 15 match "Water", 5 don't. PAGE_SIZE is 9, so more than one page
// of "Water" matches exist once loaded.
function buildNgos(): NgoProfile[] {
  const ngos: NgoProfile[] = [];
  for (let i = 0; i < 15; i++) {
    ngos.push(
      makeNgo({
        id: `water-${i}`,
        name: `Clean Water Org ${i}`,
        createdAt: new Date(2026, 0, i + 1).toISOString(),
      }),
    );
  }
  for (let i = 0; i < 5; i++) {
    ngos.push(
      makeNgo({
        id: `other-${i}`,
        name: `Education Fund ${i}`,
        createdAt: new Date(2026, 0, 100 + i).toISOString(),
      }),
    );
  }
  return ngos;
}

describe('NgoExplorer', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it('keeps search results consistent with Load more across more than one page', () => {
    const ngos = buildNgos();
    render(<NgoExplorer ngos={ngos} />);

    // First page: PAGE_SIZE (9) of the 20 total NGOs shown, unfiltered.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    // Second page: 2 * PAGE_SIZE (18) of the 20 total NGOs shown.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(18);

    // Now search: only the 15 "Water" NGOs should be considered, not just
    // the ones already loaded onto the page.
    const searchInput = screen.getByPlaceholderText('Search NGOs by name…');
    fireEvent.change(searchInput, { target: { value: 'Water' } });

    // Search resets to page 1, so only PAGE_SIZE of the 15 matches show.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9);
    expect(screen.queryByText('Education Fund 0')).not.toBeInTheDocument();

    // Load more again: all 15 matches (not 20) become visible, and no
    // non-matching NGO reappears.
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(15);
    expect(screen.queryByText('Education Fund 0')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('resets pagination to page 1 when the search term changes after loading more', () => {
    const ngos = buildNgos();
    render(<NgoExplorer ngos={ngos} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(mockReplace).toHaveBeenLastCalledWith('/ngos?page=2', { scroll: false });

    fireEvent.change(screen.getByPlaceholderText('Search NGOs by name…'), {
      target: { value: 'Water' },
    });
    expect(mockReplace).toHaveBeenLastCalledWith('/ngos?q=Water', { scroll: false });
  });

  it('restores search and page state from the URL on mount', () => {
    mockSearchParams = new URLSearchParams('q=Water&page=2');
    const ngos = buildNgos();
    render(<NgoExplorer ngos={ngos} />);

    expect(screen.getByDisplayValue('Water')).toBeInTheDocument();
    // Page 2 of the 15 "Water" matches: min(2 * 9, 15) = 15 visible.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(15);
  });

  it('restores the sort from the URL on mount', () => {
    mockSearchParams = new URLSearchParams('sort=most-active-streams');
    const ngos = [
      makeNgo({ id: 'a', name: 'Alpha', stats: { totalCommitted: '0', totalWithdrawn: '0', activeStreamCount: 1, donorCount: 0 } }),
      makeNgo({ id: 'b', name: 'Beta', stats: { totalCommitted: '0', totalWithdrawn: '0', activeStreamCount: 5, donorCount: 0 } }),
      makeNgo({ id: 'c', name: 'Gamma', stats: { totalCommitted: '0', totalWithdrawn: '0', activeStreamCount: 3, donorCount: 0 } }),
    ];
    render(<NgoExplorer ngos={ngos} />);

    expect(screen.getByRole('combobox')).toHaveValue('most-active-streams');

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('writes the sort to the URL when changed (and clears page)', () => {
    mockSearchParams = new URLSearchParams('q=Water&page=2');
    const ngos = buildNgos();
    render(<NgoExplorer ngos={ngos} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'most-committed' } });

    expect(mockReplace).toHaveBeenLastCalledWith(
      '/ngos?q=Water&sort=most-committed',
      { scroll: false },
    );
  });

  it('shows an empty state when the search matches nothing', () => {
    const ngos = buildNgos();
    render(<NgoExplorer ngos={ngos} />);

    fireEvent.change(screen.getByPlaceholderText('Search NGOs by name…'), {
      target: { value: 'Nonexistent Org' },
    });

    expect(screen.getByText('No NGOs match "Nonexistent Org".')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('renders a single card per NGO: one heading, one badge, one stats block and one link', () => {
    const ngos = [
      makeNgo({ id: 'a', name: 'Alpha', verified: true }),
      makeNgo({ id: 'b', name: 'Beta', verified: true }),
    ];
    render(<NgoExplorer ngos={ngos} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    for (const item of items) {
      const card = within(item);
      expect(card.getAllByRole('heading')).toHaveLength(1);
      expect(card.getAllByText('Verified')).toHaveLength(1);
      expect(card.getAllByText('Committed')).toHaveLength(1);
      expect(card.getAllByRole('link')).toHaveLength(1);
    }
  });
});
