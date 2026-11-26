import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/renderWithIntl';

import { Footer } from './Footer';

describe('Footer', () => {
  it('links to the GitHub organization and docs in a new tab, with an accessible cue', () => {
    renderWithIntl(<Footer />);

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
    renderWithIntl(<Footer />);

    const contact = screen.getByRole('link', { name: /^Contact/ });
    expect(contact).toHaveAttribute(
      'href',
      'https://github.com/streamgive/streamgive-frontend/issues/new',
    );
    expect(contact).toHaveAttribute('target', '_blank');
    expect(contact).toHaveAccessibleName('Contact (opens in a new tab)');
  });

  it('links to the internal FAQ page without a new-tab cue', () => {
    renderWithIntl(<Footer />);

    const faq = screen.getByRole('link', { name: 'FAQ' });
    expect(faq).toHaveAttribute('href', '/faq');
    expect(faq).not.toHaveAttribute('target');
  });

  it('links to the verification page without a new-tab cue', () => {
    renderWithIntl(<Footer />);

    const verification = screen.getByRole('link', { name: 'Verification' });
    expect(verification).toHaveAttribute('href', '/verification');
    expect(verification).not.toHaveAttribute('target');
  });

  it('links to internal privacy and terms pages without a new-tab cue', () => {
    renderWithIntl(<Footer />);

    const privacy = screen.getByRole('link', { name: 'Privacy' });
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(privacy).not.toHaveAttribute('target');

    const terms = screen.getByRole('link', { name: 'Terms' });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).not.toHaveAttribute('target');
  });

  it('shows Spanish link labels and the new-tab cue', () => {
    renderWithIntl(<Footer />, 'es');

    expect(
      screen.getByText('StreamGive — de código abierto, desarrollado sobre Stellar.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Documentación (se abre en una pestaña nueva)' }),
    ).toHaveAttribute('href', 'https://github.com/streamgive/streamgive-docs');
    expect(
      screen.getByRole('link', { name: 'Contacto (se abre en una pestaña nueva)' }),
    ).toHaveAttribute('href', 'https://github.com/streamgive/streamgive-frontend/issues/new');
    expect(screen.getByRole('link', { name: 'Preguntas frecuentes' })).toHaveAttribute(
      'href',
      '/faq',
    );
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', '/terms');
  });
});
