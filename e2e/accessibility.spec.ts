import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { name: 'landing', path: '/', heading: /give as a stream/i },
  { name: 'NGO explorer', path: '/ngos', heading: /explore ngos/i },
  { name: 'impact', path: '/impact', heading: /platform impact/i },
  { name: 'donate', path: '/ngos', heading: /start streaming to/i },
] as const;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`accessibility in ${theme} mode`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      // Seed the preference before the inline theme script runs on every navigation.
      await page.addInitScript((preference) => {
        localStorage.setItem('theme', preference);
      }, theme);
    });

    for (const target of pages) {
      test(`${target.name} has no axe violations`, async ({ page }, testInfo) => {
        await page.goto(target.path);

        if (target.name === 'donate') {
          // Use an actual verified NGO so an error or 404 page cannot pass this scan.
          const ngoLink = page
            .getByRole('main')
            .locator('a[href^="/ngos/"]')
            .filter({ hasText: 'Verified' })
            .first();
          await expect(ngoLink).toBeVisible();
          const profilePath = await ngoLink.getAttribute('href');
          expect(profilePath).toBeTruthy();
          await page.goto(`${profilePath}/donate`);
        }

        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();

        if (target.name === 'landing' || target.name === 'impact') {
          await expect(main.getByText('Total committed', { exact: true })).toBeVisible();
        } else if (target.name === 'NGO explorer') {
          await expect(main.getByRole('searchbox', { name: /search ngos by name/i })).toBeVisible();
          await expect(main.getByRole('heading', { level: 2 }).first()).toBeVisible();
        } else {
          await expect(main.getByRole('button', { name: /connect wallet/i })).toBeVisible();
        }

        // Wait for hydration and confirm the requested theme is actually applied.
        await expect(
          page
            .getByRole('button', {
              name: theme === 'light' ? 'Switch to dark mode' : 'Switch to system mode',
            })
            .first(),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        const results = await new AxeBuilder({ page }).analyze();
        await testInfo.attach('axe-results', {
          body: JSON.stringify(results, null, 2),
          contentType: 'application/json',
        });
        expect(results.violations).toEqual([]);
      });
    }
  });
}
