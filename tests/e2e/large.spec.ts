// The random graph of 10,000 units: these tests run alone, after the others, so that they do not
// share the processors (playwright.config.ts).
import { expect, test } from '@playwright/test';
import { plane } from '../../module/model/depth.ts';
import { call, expected, graphFile, open, pickAt, release, settled, snap, type Key } from './helpers.ts';

test.describe.configure({ mode: 'serial' });

test('§6.16 Speed: the random graph of 10,000 units loads at its given positions, and a root counts every unit on its plane as the rings say', async ({
  page,
}) => {
  test.setTimeout(240000);
  const e = expected('random-10k').rings[0] as { focus: Key; ringSizes: number[] };
  await open(page, 'random-10k');
  let s = await snap(page);
  expect(s.units).toHaveLength(10000);
  expect(s.units.every((u) => Number.isFinite(u.sx) && Number.isFinite(u.sy))).toBe(true);
  // The fixture's positions, scaled as 6.1 says: the larger side becomes 1,000, centred, y up.
  const pos = (graphFile('random-10k') as { vertices: { key: Key; pos: { x: number; y: number } }[] }).vertices;
  const xs = pos.map((v) => v.pos.x);
  const ys = pos.map((v) => v.pos.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = 1000 / Math.max(x1 - x0, y1 - y0);
  let worst = 0;
  pos.forEach((v, i) => {
    const u = s.units[i];
    expect(u.key).toBe(v.key);
    const dx = u.x - (v.pos.x - (x0 + x1) / 2) * scale;
    const dy = u.y + (v.pos.y - (y0 + y1) / 2) * scale;
    worst = Math.max(worst, Math.abs(dx), Math.abs(dy), Math.abs(u.z));
  });
  expect(worst).toBeLessThan(0.01);
  await call(page, 'setMode', '3d');
  await call(page, 'setRoot', e.focus);
  s = await snap(page);
  const want = { first: 0, second: 0, third: 0, far: 0 };
  e.ringSizes.forEach((n, d) => {
    if (d > 0) want[(['first', 'second', 'third'] as const)[plane(d)] ?? 'far'] += n;
  });
  await expect(page.getByTestId('plane-first')).toHaveText(want.first.toLocaleString('en'));
  await expect(page.getByTestId('plane-second')).toHaveText(want.second.toLocaleString('en'));
  await expect(page.getByTestId('plane-third')).toHaveText(want.third.toLocaleString('en'));
  await expect(page.getByTestId('plane-far')).toHaveText(want.far.toLocaleString('en'));
  await expect(page.getByTestId('deepest')).toHaveText(String(e.ringSizes.length - 1));
  const sizes: number[] = [];
  for (const u of s.units) if (u.degree !== null && u.degree >= 0) sizes[u.degree] = (sizes[u.degree] ?? 0) + 1;
  expect(sizes).toEqual(e.ringSizes);
  // A pick answers on the large graph too.
  const root = s.units.find((u) => u.key === e.focus)!;
  expect(await pickAt(page, root.sx, root.sy)).toEqual({ kind: 'unit', key: e.focus });
  await release(page);
});

test("§6.9 Hulls: with types on 10,000 units, hulls start off; the switch in the viewer's bar turns them on", async ({
  page,
}) => {
  test.setTimeout(240000);
  await open(page);
  await page.evaluate(() => (window as any).graphview.loadExample('random-10k', true));
  await settled(page);
  const toggle = page.getByRole('toolbar', { name: 'View' }).getByLabel('Hulls');
  await expect(toggle).not.toBeChecked();
  expect((await snap(page)).hulls).toEqual([]);
  await toggle.check();
  await expect.poll(async () => (await snap(page)).hulls.length, { timeout: 60000 }).toBeGreaterThan(0);
  await release(page);
});
