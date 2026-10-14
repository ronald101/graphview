// Gate G14: axe finds no serious or critical violation in the shell, in both themes; the keyboard map of F7 works.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { command, frames, open, setView, viewState } from './helpers.ts';

for (const theme of ['light', 'dark'] as const) {
  for (const example of ['database-2026-07-24', 'broken-mixed']) {
    test(`G14 axe: no serious or critical violation, ${theme} theme, ${example}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await open(page, example, { motion: 'off', theme });
      await setView(page, { selection: { units: [], keypairs: [] } });
      if (example === 'database-2026-07-24') {
        await setView(page, { selection: { units: [], keypairs: [[76, 80]] } });
        await command(page, 'showPaths', 79, 77, 2);
        await frames(page);
      }
      await page.locator('#parameters summary').click();
      const result = await new AxeBuilder({ page }).analyze();
      const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        bad.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 3)
              .join(', ')}`,
        ),
      ).toEqual([]);
    });
  }
}

test('G14 keyboard: the canvas has the role application and a name with the counts', async ({ page }) => {
  await open(page, 'database-2026-07-24');
  const canvas = page.getByRole('application');
  await expect(canvas).toHaveAccessibleName('Graph: 81 units, 84 relations');
});

test('G14 keyboard: Tab enters the canvas, and every key of F7 does its work', async ({ page }) => {
  await open(page, 'path-4');
  const canvas = page.getByTestId('canvas');
  await canvas.focus();
  await expect(canvas).toBeFocused();
  const cam = async () => (await viewState(page)).camera;
  const c0 = await cam();
  await page.keyboard.press('ArrowRight');
  expect((await cam()).x).not.toBe(c0.x);
  await page.keyboard.press('ArrowDown');
  expect((await cam()).y).not.toBe(c0.y);
  await page.keyboard.press('=');
  expect((await cam()).zoom).toBeGreaterThan(c0.zoom);
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  expect((await cam()).zoom).toBeLessThan(c0.zoom);
  await page.keyboard.press(']');
  expect((await cam()).angle).toBe(15);
  await page.keyboard.press('0');
  await frames(page);
  expect((await cam()).angle).toBe(0);
  await setView(page, { selection: { units: [2], keypairs: [] } });
  await canvas.focus();
  await page.keyboard.press('f');
  expect((await viewState(page)).focus).toBe(2);
  await page.keyboard.press('Shift+Equal');
  expect((await viewState(page)).radius).toBe(1);
  await page.keyboard.press('Tab');
  await expect(canvas).toBeFocused();
  await page.keyboard.press('Escape');
  expect((await viewState(page)).selection.units).toEqual([]);
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox', { name: 'Find a unit' })).toBeFocused();
});

test('G14 keyboard: a polite live region announces changes in words', async ({ page }) => {
  await open(page, 'database-2026-07-24');
  await setView(page, { selection: { units: [], keypairs: [[76, 80]] } });
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('live')).toHaveText('Selection cleared');
  await expect(page.getByTestId('live')).toHaveAttribute('aria-live', 'polite');
});
