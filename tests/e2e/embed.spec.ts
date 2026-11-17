// GraphView (specification 7.9), through the shell's #embed page: the whole viewer in one component,
// as the simplest host embeds it.
import { expect, test, type Page } from '@playwright/test';

// The page starts after the router loads, so the hook may come a moment after the navigation.
const events = (page: Page) => page.evaluate(() => ((window as any).embed?.events() ?? []) as string[]);
const model = <T>(page: Page, field: string) =>
  page.evaluate((f) => (window as any).embed.model()[f], field) as Promise<T>;

test('§7.9 GraphView: one component shows the bar, the canvas and the panels, and tells its host what happens', async ({
  page,
}) => {
  await page.goto('./#embed');
  await expect.poll(() => events(page), { timeout: 30000 }).toContain('ready: 81 units, 0 issues');
  const bar = page.getByRole('toolbar', { name: 'View' });
  await expect(bar.getByRole('button', { name: '2D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar.getByRole('button', { name: 'Fit', exact: true })).toBeVisible();
  await expect(bar.getByLabel('Hulls')).toBeChecked();
  await expect(page.getByRole('application')).toBeVisible();
  for (const title of ['Root and depth', 'Paths', 'Inspector', 'Filters', 'Display', 'Data issues'])
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

  // The bar and the panels change the model; GraphView reports the root and the inspection.
  await bar.getByRole('button', { name: '3D', exact: true }).click();
  expect(await model(page, 'mode')).toBe('3d');
  await expect(bar.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Root', { exact: true }).fill('unit_1');
  await page.getByLabel('Root', { exact: true }).press('Enter');
  await expect.poll(() => events(page)).toContain('root: 1');
  expect(await events(page)).toContain('inspect: unit');
  await bar.getByLabel('Hulls').uncheck();
  expect(await model(page, 'hulls')).toBe(false);
});
