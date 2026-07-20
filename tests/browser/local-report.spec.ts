import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const localReportOrigin = 'http://127.0.0.1:4174';

test.describe('private local report', () => {
  test('identifies local evidence without synthetic or scan claims', async ({ page }) => {
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== 'http://127.0.0.1:4174') externalRequests.push(request.url());
    });
    await page.goto(`${localReportOrigin}/`);
    await expect(page.getByText('Local report · no live scan · static evidence only')).toBeVisible();
    await expect(page.getByText('Synthetic fixture · no live scan · reserved domains only')).toHaveCount(0);
    await expect(page.getByText('Authorized portal evidence')).toBeVisible();
    await expect(page.getByText('A deliberately curated local report used to verify private static-report rendering.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Understand this report' })).toBeVisible();
    await expect(page.locator('input[type="url"], form')).toHaveCount(0);
    expect(externalRequests).toEqual([]);
  });

  test('explains the local and publication boundaries accessibly', async ({ page }) => {
    await page.goto(`${localReportOrigin}/demo/`);
    await expect(page.getByRole('heading', { level: 1, name: 'A report built from local evidence' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Local by default' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Publication is separate' })).toBeVisible();
    await expect(page.getByText('Curated Authorized Capture')).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('does not label curated advisories as fictional or synthetic', async ({ page }) => {
    await page.goto(`${localReportOrigin}/vulnerabilities/`);
    await expect(page.getByText('This page demonstrates a fictional advisory identifier.')).toHaveCount(0);
    await expect(page.locator('.event-card .meta')).not.toContainText('synthetic');
  });

  test('warns that generated local evidence may be sensitive', async ({ page }) => {
    await page.goto(`${localReportOrigin}/privacy/`);
    await expect(page.getByRole('heading', { level: 2, name: 'Local report surface' })).toBeVisible();
    await expect(page.getByText('Treat the generated files as potentially sensitive.', { exact: false })).toBeVisible();
  });

  test('shows limitations carried by the selected report', async ({ page }) => {
    await page.goto(`${localReportOrigin}/limitations/`);
    await expect(page.getByRole('heading', { level: 2, name: 'Recorded report limitations' })).toBeVisible();
    await expect(page.getByText('Collection is a time-bounded browser observation, not a complete network sandbox.')).toBeVisible();
  });
});
