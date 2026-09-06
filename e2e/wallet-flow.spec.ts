import { chromium, expect, test } from '@playwright/test';

/**
 * Full donor flow through an actual Freighter wallet, against testnet.
 * Skipped unless E2E_FREIGHTER_PATH is set, because it needs real, local
 * setup that can't be scripted here:
 *
 *   1. Freighter's unpacked extension, downloaded and unzipped somewhere
 *      on disk — point E2E_FREIGHTER_PATH at that folder.
 *   2. A funded testnet account already imported into that Freighter
 *      profile via its own onboarding UI. That flow isn't automated here
 *      on purpose: driving Freighter's seed-phrase/PIN setup from a test
 *      would mean putting a seed phrase in a config file somewhere, which
 *      is a secret-handling problem regardless of how "test-only" the
 *      wallet is.
 *   3. A deployed donation-vault contract and at least one verified NGO
 *      to donate to.
 *
 * Honest caveat: I have no way to run a browser in this environment, so
 * I could not verify this against Freighter's actual current UI. The
 * extension-loading setup below (launchPersistentContext with
 * --load-extension) is a documented, stable Playwright pattern; the
 * TODO below — actually driving Freighter's connection-approval popup —
 * is not verified and will need real selectors from an actual run.
 */
test.describe('core donor flow (with Freighter)', () => {
  test.skip(
    !process.env.E2E_FREIGHTER_PATH,
    'set E2E_FREIGHTER_PATH to a Freighter extension profile (with a funded testnet account already imported) to run this',
  );

  test('connect wallet, start a stream, see confirmation', async () => {
    const extensionPath = process.env.E2E_FREIGHTER_PATH as string;

    const context = await chromium.launchPersistentContext('', {
      // Extensions need a headed context in Chromium as of this writing.
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    try {
      const page = await context.newPage();
      await page.goto(process.env.E2E_BASE_URL ?? 'http://localhost:3001');

      await page.getByRole('button', { name: /connect wallet/i }).click();

      // TODO: select Freighter from the Stellar Wallets Kit modal, then
      // approve the connection in Freighter's own popup. Needs real
      // selectors from Freighter's current UI, captured on a real run.

      await expect(page.getByRole('button', { name: /connect wallet/i })).not.toBeVisible();
    } finally {
      await context.close();
    }
  });
});
