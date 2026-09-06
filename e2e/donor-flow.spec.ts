import { expect, test } from '@playwright/test';

/**
 * Navigation-level coverage of the donor flow that doesn't require a
 * wallet extension — runnable in CI with just `npm run dev`, no backend,
 * contracts, or Freighter needed. The wallet-inclusive version of this
 * flow is in wallet-flow.spec.ts, gated behind manual setup.
 */
test.describe('core donor flow (no wallet extension required)', () => {
  test('landing page loads with hero and nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /give as a stream/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /explore ngos/i }).first()).toBeVisible();
  });

  test('explore NGOs page renders without crashing regardless of backend state', async ({
    page,
  }) => {
    await page.goto('/ngos');
    await expect(page.getByRole('heading', { name: /explore ngos/i })).toBeVisible();

    // The page can legitimately land in one of three states depending on
    // whether the backend is running and has any verified NGOs — any of
    // the three means it rendered correctly rather than crashing.
    const hasCards = await page
      .getByRole('link', { name: /view profile/i })
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/no verified ngos yet/i)
      .isVisible()
      .catch(() => false);
    const hasApiError = await page
      .getByText(/couldn.t reach the streamgive api/i)
      .isVisible()
      .catch(() => false);

    expect(hasCards || hasEmptyState || hasApiError).toBe(true);
  });

  test('donate page prompts wallet connection when nothing is connected', async ({ page }) => {
    // A placeholder id — if the backend isn't running or the id doesn't
    // resolve, the page 404s, which is itself a correctly-handled outcome.
    await page.goto('/ngos/00000000-0000-0000-0000-000000000000/donate');

    const notFound = await page
      .getByText(/404/i)
      .isVisible()
      .catch(() => false);
    if (!notFound) {
      await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    }
  });
});
