// The random graph of 10,000 units: these tests run alone, after the others, so that they
// do not share the processors (playwright.config.ts).
import { expect, test } from '@playwright/test';
import {
  command,
  events,
  expected,
  expectNear,
  frames,
  open,
  scene,
  setView,
  unit,
  viewState,
  type Key,
} from './helpers.ts';

test.describe.configure({ mode: 'serial' });

test('V06 force layout: the random graph of 10,000 units settles within 30 seconds', async ({ page }) => {
  test.setTimeout(180000);
  await open(page, 'random-10k');
  const vs = await viewState(page);
  const t0 = Date.now();
  await command(page, 'setLayout', { ...vs.layout, name: 'force', seed: 1 });
  const ms = Date.now() - t0;
  const p = (await events(page, 'layoutsettled')).at(-1)!.payload.positions as { x: number; y: number }[];
  expect(p.length).toBe(10000);
  expect(p.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
  expect(ms).toBeLessThan(30000);
  test.info().annotations.push({ type: 'force-10k-ms', description: String(ms) });
});

test('V07 rings: random-10k, focus 0, stored graph: ring sizes agree with C4 and units sit on their rings', async ({
  page,
}) => {
  test.setTimeout(240000);
  const e = expected('random-10k').rings[0] as { focus: Key; ringSizes: number[] };
  await open(page, 'random-10k');
  const vs = await viewState(page);
  await setView(page, { focus: e.focus, layout: { ...vs.layout, name: 'rings' } });
  await frames(page);
  const s = await scene(page);
  const sizes: number[] = [];
  for (const u of s.units) if (u.state.ring !== null) sizes[u.state.ring] = (sizes[u.state.ring] ?? 0) + 1;
  expect(sizes).toEqual(e.ringSizes);
  const focus = unit(s, e.focus);
  for (const u of s.units) {
    if (u.state.ring === null || u.state.ring === 0) continue;
    const r = s.rings.find((x) => x.index === u.state.ring)!;
    expectNear(Math.hypot(u.x - focus.x, u.y - focus.y), r.radius, 1, `unit ${u.key}`);
  }
});
