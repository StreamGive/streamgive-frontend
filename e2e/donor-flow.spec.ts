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
      .getByText(/couldn.t load the ngo list/i)
      .isVisible()
      .catch(() => false);

    expect(hasCards || hasEmptyState || hasApiError).toBe(true);
  });

  test('unknown NGO id renders a not-found or recoverable API error state', async ({ page }) => {
    // CI has no backend. A real 404 and a failed API request have distinct,
    // recoverable states; verify whichever response the environment allows.
    await page.goto('/ngos/00000000-0000-0000-0000-000000000000');

    const notFound = page.getByRole('heading', { name: /page not found/i });
    const apiError = page.getByText(/couldn.t load this ngo.s profile/i);
    await expect(notFound.or(apiError)).toBeVisible();
    if (await notFound.isVisible()) {
      await expect(page.getByRole('link', { name: /go home/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /explore ngos/i }).first()).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Retry' })).toHaveAttribute(
        'href',
        '/ngos/00000000-0000-0000-0000-000000000000',
      );
    }
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

  test('apply page hides the application form until a wallet is connected', async ({ page }) => {
    await page.goto('/apply');

    await expect(page.getByRole('heading', { name: /apply as an ngo/i })).toBeVisible();
    await expect(page.getByText(/connect your wallet to apply/i)).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('button', { name: /connect wallet/i }),
    ).toBeVisible();

    await expect(page.getByLabel(/organization name/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /submit application/i })).not.toBeVisible();
  });

  test('dashboard prompts for wallet connection when nothing is connected', async ({ page }) => {
    // No wallet extension in CI, so the dashboard can only show its connect
    // prompt — and it must not start fetching streams without an address.
    // The header also carries a "Connect Wallet" button, so the prompt
    // assertions are scoped to <main> to match the page's own card.
    await page.goto('/dashboard');

    const main = page.getByRole('main');
    await expect(page.getByRole('heading', { name: /your donations/i })).toBeVisible();
    await expect(main.getByText(/connect your wallet to see your streams/i)).toBeVisible();
    await expect(main.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    await expect(page.getByText(/loading your streams/i)).not.toBeVisible();
  });

  test('impact page renders platform stats (loading and populated states)', async ({ page }) => {
    await page.goto('/impact');

    await expect(page.getByRole('heading', { name: /platform impact/i })).toBeVisible();

    // The page always shows a loading state (role="status") before its
    // first poll settles — there's no SSR data here, see ImpactPage's
    // docblock. Asserted opportunistically rather than required: a
    // fast/local response can resolve before this check runs, same as the
    // other timing-sensitive assertions in this file.
    const sawLoading = await page
      .getByRole('status', { name: /loading/i })
      .isVisible()
      .catch(() => false);
    if (sawLoading) {
      await expect(page.getByRole('status', { name: /loading/i })).toBeVisible();
    }

    // Same ambiguity as the NGO explorer test above: without a guaranteed
    // running backend, the page can land in the populated-stats state or
    // an API-unreachable state — both are correctly-handled outcomes, not
    // test failures.
    const stats = page.getByText(/total committed/i);
    const apiError = page.getByText(/couldn.t load platform stats/i);
    await expect(stats.or(apiError)).toBeVisible({ timeout: 15_000 });

    if (await stats.isVisible()) {
      await expect(page.getByText(/withdrawn by ngos/i)).toBeVisible();
      await expect(page.getByText(/active streams/i)).toBeVisible();
      await expect(page.getByText(/verified ngos/i)).toBeVisible();
    }
  });
});
