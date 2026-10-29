// Gate G17: speed in the test browser. Runs alone, after the other browser tests (playwright.config.ts).
// The bench page runs last, and leaves its heavy scene before the test ends.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { open, release } from './helpers.ts';

test.describe.configure({ mode: 'serial' });

const numbers: Record<string, unknown> = {};

test('§6.16 Speed (G17): the path set of the complete graph of nine is answered within 2 seconds', async ({ page }) => {
  await open(page, 'complete-9');
  const ms = await page.evaluate(async () => {
    const m = (window as any).graphview.model;
    await m.setRoot(1);
    const t0 = performance.now();
    const r = await m.setTarget(2);
    return { ms: performance.now() - t0, total: r.total, stopped: r.stopped };
  });
  numbers.completeNinePathSet = ms;
  expect(ms.total).toBeGreaterThan(0);
  expect(ms.ms).toBeLessThanOrEqual(2000);
});

test('§6.16 Speed (G17): first pictures and zoom frames, measured by the bench page', async ({ page }) => {
  test.setTimeout(300000);
  await page.goto('./#bench');
  // The page starts after the router loads, so the hook may come a moment after the navigation.
  await page.waitForFunction(() => (window as any).bench);
  const rows = await page.evaluate(() => (window as any).bench.run());
  const [sample, random] = rows;
  numbers.bench = rows;
  numbers.graphics = await page.getByTestId('graphics').textContent();
  await release(page);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/speed.json', JSON.stringify(numbers, null, 1));
  expect(sample.firstPictureMs, 'sample graph, first picture').toBeLessThanOrEqual(1000);
  expect(random.firstPictureMs, 'random graph, first picture').toBeLessThanOrEqual(5000);
  expect(sample.zoom.median, 'sample graph, median zoom frame').toBeLessThanOrEqual(50);
});
