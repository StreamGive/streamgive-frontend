import { expect, test } from '@playwright/test';

/**
 * The /embed/:ngoId widget is meant to be loaded in an <iframe> on a
 * partner's own site, not visited as a page in its own right — AppShell
 * skips the header, footer and testnet banner for the whole /embed path
 * (see src/components/common/AppShell.tsx). CI has no backend, so getNgo()
 * throws and the widget renders its own inline error state rather than the
 * donate form — that's still a valid check: the chrome is excluded based
 * on the path alone, regardless of which render branch the page lands on.
 */
test.describe('embed widget has no site chrome', () => {
  test('/embed/:ngoId omits the header, footer and testnet banner', async ({ page }) => {
    await page.goto('/embed/00000000-0000-0000-0000-000000000000');

    await expect(page.locator('main#main')).toBeVisible();

    // <header>'s implicit landmark role is "banner" — distinct from the
    // testnet EnvironmentBanner checked via role="alert" below.
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
