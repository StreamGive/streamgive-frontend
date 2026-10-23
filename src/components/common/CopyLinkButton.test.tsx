import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyLinkButton } from './CopyLinkButton';

describe('CopyLinkButton', () => {
  const originalUrl = window.location.href;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalUrl);
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('copies the absolute current URL and shows a confirmation that resets', async () => {
    window.history.replaceState(null, '', '/ngos/ngo-123?ref=share#details');
    render(<CopyLinkButton />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/ngos/ngo-123?ref=share#details`,
    );
    expect(screen.getByRole('button', { name: 'Link copied!' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Link copied to clipboard.');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('copies an absolute URL for the supplied path instead of the current page', async () => {
    window.history.replaceState(null, '', '/ngos/ngo-123/donate/success');
    render(<CopyLinkButton path="/ngos/ngo-123" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/ngos/ngo-123`,
    );
    expect(screen.getByRole('button', { name: 'Link copied!' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Link copied to clipboard.');
  });

  it('shows an error and fallback instructions when the clipboard write fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Permission denied'));
    render(<CopyLinkButton path="/ngos/ngo-123" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/ngos/ngo-123`,
    );
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not copy the link. Copy it from the address bar instead.',
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
