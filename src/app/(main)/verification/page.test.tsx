import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import en from '../../../../messages/en.json';
import es from '../../../../messages/es.json';

let messages: typeof en.Verification = en.Verification;

vi.mock('next-intl/server', () => ({
  getTranslations: async () => {
    const t = (key: keyof typeof messages) => messages[key];
    t.raw = (key: keyof typeof messages) => messages[key];
    return t;
  },
}));

import VerificationPage, { generateMetadata } from './page';

describe('VerificationPage', () => {
  it('explains the verification steps and limits in English', async () => {
    messages = en.Verification;
    render(await VerificationPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'How NGOs are verified' }),
    ).toBeInTheDocument();
    for (const step of en.Verification.steps) {
      expect(
        screen.getByRole('heading', { level: 3, name: new RegExp(step.title) }),
      ).toBeInTheDocument();
    }
    for (const limit of en.Verification.limits) {
      expect(screen.getByText(limit)).toBeInTheDocument();
    }
  });

  it('renders the Spanish copy when that locale is selected', async () => {
    messages = es.Verification as typeof en.Verification;
    render(await VerificationPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cómo se verifican las ONG' }),
    ).toBeInTheDocument();
  });

  it('sets the page title and description from the translations', async () => {
    messages = en.Verification;

    await expect(generateMetadata()).resolves.toEqual({
      title: 'How NGOs are verified',
      description: en.Verification.description,
    });
  });

  it('keeps the English and Spanish content the same length', () => {
    expect(es.Verification.steps).toHaveLength(en.Verification.steps.length);
    expect(es.Verification.limits).toHaveLength(en.Verification.limits.length);
  });
});
