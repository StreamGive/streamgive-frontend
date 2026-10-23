import { expect, test } from '@playwright/test';

/**
 * ThemeToggle writes its preference to localStorage and THEME_INIT_SCRIPT
 * (injected into <head>, see src/lib/theme.ts and src/app/layout.tsx)
 * re-applies it to <html> before hydration on every load — nothing in the
 * existing suite actually reloads the page to check that round-trip.
 */
test.describe('theme preference', () => {
  test('toggling to dark mode survives a reload', async ({ page }) => {
    await page.goto('/');

    // A fresh browser context has no stored preference, so this starts on
    // 'system' — two clicks cycle it: system -> light -> dark.
    const toggle = page.getByRole('button', { name: /switch to/i });

    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Switch to dark mode');

    await toggle.click();
    await expect(toggle).toHaveAccessibleName('Switch to system mode');

    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

    await page.reload();

    // THEME_INIT_SCRIPT re-applies the stored class before hydration, so
    // this holds even before ThemeToggle itself has mounted.
    await expect(page.locator('html')).toHaveClass(/dark/);

    // And the toggle, once mounted, reads the same stored preference back
    // rather than resetting to 'system'.
    await expect(page.getByRole('button', { name: 'Switch to system mode' })).toBeVisible();
  });
});
