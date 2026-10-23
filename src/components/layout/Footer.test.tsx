import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

describe('Footer', () => {
  it('links to the GitHub organization and docs in a new tab, with an accessible cue', () => {
    render(<Footer />);

    const github = screen.getByRole('link', { name: /^GitHub/ });
    expect(github).toHaveAttribute('href', 'https://github.com/streamgive');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAccessibleName('GitHub (opens in a new tab)');

    const docs = screen.getByRole('link', { name: /^Docs/ });
    expect(docs).toHaveAttribute('href', 'https://github.com/streamgive/streamgive-docs');
    expect(docs).toHaveAttribute('target', '_blank');
    expect(docs).toHaveAccessibleName('Docs (opens in a new tab)');
  });

  it('links to GitHub issues for contact, with an accessible cue', () => {
    render(<Footer />);

    const contact = screen.getByRole('link', { name: /^Contact/ });
    expect(contact).toHaveAttribute(
      'href',
      'https://github.com/streamgive/streamgive-frontend/issues/new',
    );
    expect(contact).toHaveAttribute('target', '_blank');
    expect(contact).toHaveAccessibleName('Contact (opens in a new tab)');
  });

  it('links to internal privacy and terms pages without a new-tab cue', () => {
    render(<Footer />);

    const privacy = screen.getByRole('link', { name: 'Privacy' });
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(privacy).not.toHaveAttribute('target');

    const terms = screen.getByRole('link', { name: 'Terms' });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).not.toHaveAttribute('target');
  });
});