import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteProgressBar } from './RouteProgressBar';

const navigation = vi.hoisted(() => ({
  pathname: '/ngos',
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

const originalUrl = window.location.href;

// Cancel browser navigation after the component's document listener has run.
function preventNavigation(event: MouseEvent) {
  event.preventDefault();
}

function renderProgressBar(href = '/dashboard', target?: string) {
  return render(
    <>
      <RouteProgressBar />
      <a href={href} target={target}>
        <span>Destination</span>
      </a>
    </>,
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/ngos');
  navigation.pathname = '/ngos';
  navigation.searchParams = new URLSearchParams();
  window.addEventListener('click', preventNavigation);
});

afterEach(() => {
  window.removeEventListener('click', preventNavigation);
  window.history.replaceState(null, '', originalUrl);
});

describe('RouteProgressBar', () => {
  it('starts hidden', () => {
    renderProgressBar();

    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
  });

  it.each(['relative', 'absolute'])('shows for a %s same-origin link click', (kind) => {
    const href = kind === 'relative' ? '/dashboard' : `${window.location.origin}/dashboard`;
    renderProgressBar(href);

    // Clicking a child also exercises delegation through the enclosing link.
    fireEvent.click(screen.getByText('Destination'));

    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();
  });

  it('ignores external link clicks', () => {
    renderProgressBar('https://external.example/dashboard');

    fireEvent.click(screen.getByRole('link', { name: 'Destination' }));

    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
  });

  it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'])(
    'ignores clicks modified with %s',
    (modifier) => {
      renderProgressBar();

      fireEvent.click(screen.getByRole('link', { name: 'Destination' }), { [modifier]: true });

      expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
    },
  );

  it('ignores links with target=_blank', () => {
    renderProgressBar('/dashboard', '_blank');

    fireEvent.click(screen.getByRole('link', { name: 'Destination' }));

    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
  });

  it.each([
    { label: 'pathname', pathname: '/dashboard', search: '' },
    { label: 'query string', pathname: '/ngos', search: '?page=2' },
  ])('hides when the $label changes', ({ pathname, search }) => {
    const { rerender } = renderProgressBar(`${pathname}${search}`);
    fireEvent.click(screen.getByRole('link', { name: 'Destination' }));
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();

    window.history.replaceState(null, '', `${pathname}${search}`);
    navigation.pathname = pathname;
    navigation.searchParams = new URLSearchParams(search);
    rerender(<RouteProgressBar />);

    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
  });
});
