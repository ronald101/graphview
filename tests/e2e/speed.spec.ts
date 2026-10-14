// Gate G17: speed in the test browser. Runs alone, after the other browser tests (playwright.config.ts).
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { open } from './helpers.ts';

test.describe.configure({ mode: 'serial' });

const numbers: Record<string, unknown> = {};

test('G17 speed: first pictures and zoom frames, measured by the bench page', async ({ page }) => {
  test.setTimeout(300000);
  await page.goto('./#bench');
  const rows = await page.evaluate(() => (window as any).bench.run());
  const [db, random] = rows;
  numbers.bench = rows;
  numbers.graphics = await page.getByTestId('graphics').textContent();
  expect(db.firstPictureMs, 'database graph, first picture').toBeLessThanOrEqual(1000);
  expect(random.firstPictureMs, 'random graph, first picture').toBeLessThanOrEqual(5000);
  expect(db.zoom.median, 'database graph, median zoom frame').toBeLessThanOrEqual(50);
});

test('G17 speed: the path set of the complete graph of nine is answered within 2 seconds', async ({ page }) => {
  await open(page, 'complete-9');
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    const r = await (window as any).graphview.view.showPaths(1, 2, 7);
    return { ms: performance.now() - t0, total: r.total, stopped: r.stopped };
  });
  numbers.completeNinePathSet = ms;
  expect(ms.stopped).toBe(true);
  expect(ms.ms).toBeLessThanOrEqual(2000);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/speed.json', JSON.stringify(numbers, null, 1));
});
