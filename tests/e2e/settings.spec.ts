// The settings (specification 5.9, 5.10 and 7.10) on the embed page, whose GraphView keeps its settings
// file behind the shell's route. Each test's browser has its own file there.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function ready(page: Page) {
  await page.goto('./#embed');
  await expect
    .poll(() => page.evaluate(() => ((window as any).embed?.events() ?? []) as string[]), { timeout: 30000 })
    .toContainEqual(expect.stringMatching(/^ready/));
}
const value = (page: Page, key: string) => page.evaluate((k) => (window as any).embed.model().settings.get(k), key);
const reach = (page: Page) =>
  page.evaluate(() => {
    const units = (window as any).embed.scene().units as { reach: number }[];
    return units.reduce((s, u) => s + u.reach, 0) / units.length;
  });
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  return dialog;
}
const saved = (page: Page) => expect(page.getByTestId('settings-status')).toHaveText('Saved');

test('§7.10 The Settings dialog and pins: every group, a filter, a slider that changes the picture, Reset and Reset all', async ({
  page,
}) => {
  await ready(page);
  const dialog = await settings(page);
  await expect(dialog.locator('.gv-section')).toHaveCount(31);
  await dialog.getByLabel('Filter the settings').fill('units.radius');
  await expect(dialog.locator('.gv-setting')).toHaveCount(1);
  const before = await reach(page);
  await dialog.getByLabel('Radius', { exact: true }).fill('20');
  await expect.poll(() => value(page, 'units.radius')).toBe(20);
  await expect.poll(() => reach(page)).toBeGreaterThan(before + 3);
  const row = dialog.getByTestId('setting-units.radius');
  await expect(row).toContainText('Default: 6');
  await row.getByRole('button', { name: 'Reset Radius' }).click();
  expect(await value(page, 'units.radius')).toBe(6);
  await expect(row).not.toContainText('Default:');
  await expect(row.getByRole('button', { name: 'Reset Radius' })).toBeDisabled();
  // Reset all returns every setting the person changed.
  await dialog.getByLabel('Filter the settings').fill('');
  await dialog.getByLabel('Filter the settings').fill('labels.size');
  await dialog.getByLabel('Size', { exact: true }).fill('20');
  await dialog.getByLabel('Filter the settings').fill('lines.width');
  await dialog.getByLabel('Width', { exact: true }).fill('3');
  expect([await value(page, 'labels.size'), await value(page, 'lines.width')]).toEqual([20, 3]);
  await dialog.getByRole('button', { name: 'Reset all' }).click();
  expect([await value(page, 'labels.size'), await value(page, 'lines.width')]).toEqual([12, 1.5]);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('§7.10 The Settings dialog and pins: a pin shows a setting in the side bar with the same control', async ({
  page,
}) => {
  await ready(page);
  const pinned = page.getByTestId('pinned-panel');
  await expect(pinned).toContainText('Pin a setting in the Settings dialog to keep it here.');
  const dialog = await settings(page);
  await dialog.getByLabel('Filter the settings').fill('chevrons.size');
  await dialog.getByRole('button', { name: 'Pin Size' }).click();
  await expect(dialog.getByRole('button', { name: 'Unpin Size' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(pinned.getByTestId('setting-chevrons.size')).toBeVisible();
  await pinned.getByLabel('Size', { exact: true }).fill('24');
  expect(await value(page, 'chevrons.size')).toBe(24);
  await pinned.getByRole('button', { name: 'Unpin Size' }).click();
  await expect(pinned).toContainText('Pin a setting in the Settings dialog to keep it here.');
});

test('§5.10 The settings handler: settings and pins survive a reload through /graphview/api/settings', async ({
  page,
}) => {
  await ready(page);
  const dialog = await settings(page);
  await dialog.getByLabel('Filter the settings').fill('labels.size');
  await dialog.getByLabel('Size', { exact: true }).fill('16');
  await dialog.getByRole('button', { name: 'Pin Size' }).click();
  await saved(page);
  const stored = await (await page.request.get('./api/settings')).json();
  expect(stored).toMatchObject({
    format: 'graphview-settings/1',
    values: { 'labels.size': 16 },
    pinned: ['labels.size'],
  });
  expect(stored.revision).toBeGreaterThan(0);
  await page.reload();
  await ready(page);
  expect(await value(page, 'labels.size')).toBe(16);
  await expect(page.getByTestId('pinned-panel').getByTestId('setting-labels.size')).toContainText('Default: 12');
  // The handler refuses a file of another revision, with the stored one.
  const stale = await page.request.put('./api/settings', {
    data: { format: 'graphview-settings/1', revision: 0, values: {}, pinned: [] },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).values).toEqual({ 'labels.size': 16 });
});

test('§7.10 The Settings dialog and pins: a refused value says why and changes nothing', async ({ page }) => {
  await ready(page);
  const dialog = await settings(page);
  await dialog.getByLabel('Filter the settings').fill('depth.maxPlanes');
  const field = dialog.getByLabel('Deepest plane', { exact: true });
  await field.fill('99');
  await field.press('Enter');
  await expect(dialog.getByRole('alert')).toHaveText('A whole number from 1 to 30');
  expect(await value(page, 'depth.maxPlanes')).toBe(6);
});

test('§7.10 The Settings dialog and pins: Export writes the settings file, Import reads one', async ({ page }) => {
  await ready(page);
  const dialog = await settings(page);
  await dialog.getByLabel('Filter the settings').fill('labels.size');
  await dialog.getByLabel('Size', { exact: true }).fill('14');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('graphview-settings.json');
  expect(JSON.parse(readFileSync(await file.path(), 'utf8')).values).toEqual({ 'labels.size': 14 });
  // As a buffer: a file path with "§", as the tests' output folders have, does not reach the page.
  const text = JSON.stringify({
    format: 'graphview-settings/1',
    values: { 'chevrons.size': 20, 'no.such': 1 },
    pinned: [],
  });
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'import.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect.poll(() => value(page, 'chevrons.size')).toBe(20);
  expect(await value(page, 'labels.size')).toBe(12);
  await expect(dialog.getByTestId('settings-status')).toContainText('No setting is called no.such');
});
