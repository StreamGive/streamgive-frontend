import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './ToastProvider';

function TestComponent() {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast('success', 'Success Toast')}>Show Success</button>
      <button
        onClick={() =>
          showToast('success', 'With Action', {
            label: 'View transaction',
            url: 'https://stellar.expert/explorer/testnet/tx/123',
          })
        }
      >
        Show With Action
      </button>
      <button onClick={() => showToast('error', 'Error Toast')}>Show Error</button>
      <button onClick={() => showToast('info', 'Info Toast')}>Show Info</button>
    </>
  );
}

function OutsideProvider() {
  useToast();
  return null;
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast and removes it after 5 seconds', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));
    
    expect(screen.getByText('Success Toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Success Toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Success Toast')).not.toBeInTheDocument();
  });

  it('renders error-type toasts with role="alert" while other toast types render with role="status"', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Error'));
    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByRole('alert')).toHaveTextContent('Error Toast');
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByText('Success Toast').closest('[role="status"]')).toBeInTheDocument();
    expect(screen.getByText('Info Toast').closest('[role="status"]')).toBeInTheDocument();
  });

  it('throws an error when useToast is used outside of ToastProvider', () => {
    const originalError = console.error;
    console.error = vi.fn();
    
    expect(() => render(<OutsideProvider />)).toThrow('useToast must be used within a ToastProvider');
    
    console.error = originalError;
  });

  it('renders an action link when action is provided', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show With Action'));
    const link = screen.getByRole('link', { name: 'View transaction' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/tx/123');
  });

  describe('pause, resume and dismiss', () => {
    function renderWithToast(buttonLabel = 'Show Success') {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByText(buttonLabel));
    }

    const toastBox = () => screen.getByRole('status');

    it('stops the auto-dismiss timer while the toast is hovered', () => {
      renderWithToast();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      fireEvent.mouseEnter(toastBox());
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText('Success Toast')).toBeInTheDocument();
    });

    it('restarts the timer when the pointer leaves', () => {
      renderWithToast();

      fireEvent.mouseEnter(toastBox());
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      fireEvent.mouseLeave(toastBox());

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(screen.getByText('Success Toast')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Success Toast')).not.toBeInTheDocument();
    });

    it('stops the auto-dismiss timer while focus is inside the toast', () => {
      renderWithToast();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      fireEvent.focus(screen.getByRole('button', { name: 'Dismiss notification' }));
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText('Success Toast')).toBeInTheDocument();
    });

    it('restarts the timer when focus leaves the toast', () => {
      renderWithToast();
      const dismiss = screen.getByRole('button', { name: 'Dismiss notification' });

      fireEvent.focus(dismiss);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      fireEvent.blur(dismiss);

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(screen.getByText('Success Toast')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Success Toast')).not.toBeInTheDocument();
    });

    it('only pauses the toast that is hovered', () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByText('Show Success'));
      fireEvent.click(screen.getByText('Show Info'));

      fireEvent.mouseEnter(screen.getAllByRole('status')[0]);
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('Success Toast')).toBeInTheDocument();
      expect(screen.queryByText('Info Toast')).not.toBeInTheDocument();
    });

    it('removes the toast immediately when the dismiss button is clicked', () => {
      renderWithToast();

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

      expect(screen.queryByText('Success Toast')).not.toBeInTheDocument();
    });

    it('clears the auto-dismiss timer of a manually dismissed toast', () => {
      renderWithToast();
      expect(vi.getTimerCount()).toBe(1);

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
