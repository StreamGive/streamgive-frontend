import { expect, test } from '@playwright/test';

/**
 * The rest of the e2e suite runs at the default desktop viewport, where
 * Header renders its `md:flex` nav and never mounts the hamburger menu at
 * all — so the mobile menu (`md:hidden`, toggled open/closed, closes again
 * on navigation) has never actually run in a browser. Tailwind's `md`
 * breakpoint is 768px (see Header.tsx), so this viewport has to stay under
 * that for the hamburger to render.
 */
test.describe('mobile navigation menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens on tap, follows a link, and closes itself', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    const mobileNav = page.locator('#mobile-nav');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(mobileNav).toBeHidden();

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(mobileNav).toBeVisible();

    await mobileNav.getByRole('link', { name: 'Dashboard' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /your donations/i })).toBeVisible();

    // Following the link closes the menu — it must not still be open,
    // covering the page the visitor landed on.
    await expect(mobileNav).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
