import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/changes/', '/routes/', '/origins/', '/graph/', '/findings/', '/components/', '/vulnerabilities/', '/methodology/', '/privacy/', '/limitations/', '/demo/'];
const publicReportBase = 'http://127.0.0.1:4173/scriptledger';

test.describe('synthetic static report', () => {
  for (const route of routes) {
    test(`${route} is accessible, local-only, and overflow-safe at 320px`, async ({ page }) => {
      const externalRequests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
      });
      await page.setViewportSize({ width: 320, height: 760 });
      await page.goto(`${publicReportBase}${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      expect(externalRequests).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }

  test('overview identifies the fixture and exposes no scan form', async ({ page }) => {
    await page.goto(`${publicReportBase}/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Know what your pages depend on.' })).toBeVisible();
    await expect(page.getByText('Synthetic fixture · no live scan · reserved domains only')).toBeVisible();
    await expect(page.locator('input[type="url"], form')).toHaveCount(0);
  });

  test('graph has a complete tabular alternative', async ({ page }) => {
    await page.goto(`${publicReportBase}/graph/`);
    await expect(page.getByRole('table', { name: 'Every relationship displayed in the graph.' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Origin node' })).toBeVisible();
  });

  test('malicious-looking fixture text is escaped and does not execute', async ({ page }) => {
    await page.goto(`${publicReportBase}/components/`);
    await expect(page.getByText('<img src=x onerror=globalThis.__scriptledgerInjected=true>')).toBeVisible();
    expect(await page.evaluate(() => (globalThis as typeof globalThis & { __scriptledgerInjected?: boolean }).__scriptledgerInjected)).toBeUndefined();
    await expect(page.locator('img')).toHaveCount(0);
  });

  test('keyboard navigation reaches the report content', async ({ page }) => {
    await page.goto(`${publicReportBase}/`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to report' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('navigation remains inside the Pages project path', async ({ page }) => {
    await page.goto(`${publicReportBase}/`);
    const navigationTargets = await page.locator('header a, .actions a, footer a').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));

    expect(navigationTargets.length).toBeGreaterThan(0);
    expect(navigationTargets.every((target) => new URL(target).pathname.startsWith('/scriptledger/'))).toBe(true);

    await page.getByRole('link', { name: 'Changes', exact: true }).click();
    await expect(page).toHaveURL(`${publicReportBase}/changes/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Recent trust changes' })).toBeVisible();
  });
});
