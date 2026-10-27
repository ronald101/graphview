// Gate G14: axe finds no serious or critical violation in the shell, in both themes, with every
// section open; the canvas has the role application and a name with the counts (specification 9.3, 6.14).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { call, longestLine, open, pickAt, snap } from './helpers.ts';

for (const theme of ['light', 'dark'] as const) {
  for (const example of ['sample', 'broken-mixed']) {
    test(`§9.3 Accessibility (G14): axe finds no serious or critical violation, ${theme} theme, ${example}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await open(page, example, { motion: 'off', theme });
      if (example === 'sample') {
        await call(page, 'setMode', '3d');
        await call(page, 'setRoot', 79);
        await call(page, 'setTarget', 77);
        const { line } = longestLine(await snap(page));
        await call(page, 'inspect', await pickAt(page, line.sx, line.sy));
      }
      const closed = page.locator('.gv-section h2 button[aria-expanded=false]');
      while ((await closed.count()) > 0) await closed.first().click();
      await page.getByTestId('explanation').locator('summary').click();
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

test('§6.14 Keyboard (G14): Tab reaches the canvas, which has the role application and a name with the counts', async ({
  page,
}) => {
  await open(page);
  const canvas = page.getByRole('application');
  await expect(canvas).toHaveAccessibleName('Graph in 2D: 81 units, 84 relations');
  await page.getByLabel('Paths to').focus();
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Shift+Tab');
    reached = await canvas.evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
});
