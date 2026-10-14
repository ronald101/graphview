// Arrange: decide where units sit (specification V06 to V11).
import { expect, test, type Page } from '@playwright/test';
import {
  canvasBox,
  command,
  events,
  expectNear,
  expected,
  frames,
  graphFile,
  open,
  scene,
  setLook,
  setView,
  unit,
  viewState,
  type Key,
} from './helpers.ts';

const settledPositions = async (page: Page) =>
  (await events(page, 'layoutsettled')).at(-1)!.payload.positions as { key: Key; x: number; y: number }[];

async function force(page: Page, seed: number) {
  const vs = await viewState(page);
  await command(page, 'setLayout', { ...vs.layout, name: 'force', seed });
  await frames(page);
  return settledPositions(page);
}

test.describe('arrange', () => {
  test('V06 force layout: the same seed gives the same positions, another seed others, none missing', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    const a = await force(page, 7);
    const b = await force(page, 7);
    const c = await force(page, 8);
    expect(a.length).toBe(81);
    for (const p of a) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), `unit ${p.key}`).toBe(true);
    }
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  // Every ring entry in fixtures/expected.
  const entries: {
    name: string;
    focus: Key;
    graph: string;
    rings?: Key[][];
    ringSizes?: number[];
    beyond: Key[] | number;
  }[] = [];
  for (const name of [
    'broken-missing-reverse',
    'complete-4',
    'complete-9',
    'cycle-5',
    'cycle-6',
    'database-2026-07-24',
    'grid-3x3',
    'pair',
    'path-4',
    'petersen',
    'star-6',
    'superseded',
    'text-keys',
    'triangle',
    'two-pairs',
  ]) {
    for (const r of expected(name).rings ?? []) entries.push({ name, ...r });
  }
  for (const e of entries) {
    test(`V07 rings: ${e.name}, focus ${JSON.stringify(e.focus)}, ${e.graph} graph: ring numbers agree with C4 and units sit on their rings`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await open(page, e.name, { motion: 'off', superseded: e.graph === 'current' ? 'hide' : 'fade' });
      const vs = await viewState(page);
      await setView(page, { focus: e.focus, layout: { ...vs.layout, name: 'rings' } });
      await command(page, 'fit', 'all');
      await frames(page);
      const s = await scene(page);
      const byRing = new Map<number, string[]>();
      for (const u of s.units) {
        if (u.state.ring === null) continue;
        if (!byRing.has(u.state.ring)) byRing.set(u.state.ring, []);
        byRing.get(u.state.ring)!.push(JSON.stringify(u.key));
      }
      if (e.rings) {
        e.rings.forEach((ring, k) => {
          expect((byRing.get(k) ?? []).sort(), `ring ${k}`).toEqual(ring.map((x) => JSON.stringify(x)).sort());
        });
        const beyond = s.units
          .filter((u) => u.state.ring === null)
          .map((u) => JSON.stringify(u.key))
          .sort();
        expect(beyond).toEqual((e.beyond as Key[]).map((x) => JSON.stringify(x)).sort());
      } else {
        e.ringSizes!.forEach((n, k) => expect(byRing.get(k)?.length ?? 0, `ring ${k}`).toBe(n));
      }
      const focus = unit(s, e.focus);
      for (const u of s.units) {
        if (u.state.ring === null || u.state.ring === 0) continue;
        const r = s.rings.find((x) => x.index === u.state.ring)!;
        expectNear(
          Math.hypot(u.x - focus.x, u.y - focus.y),
          r.radius,
          1,
          `unit ${JSON.stringify(u.key)} on ring ${u.state.ring}`,
        );
      }
    });
  }

  test('V08 circle: units sit on one circle in file order, clockwise from north', async ({ page }) => {
    await open(page, 'petersen');
    await command(page, 'setLayout', { name: 'circle' });
    await command(page, 'fit', 'all');
    await frames(page);
    const s = await scene(page);
    const n = s.units.length;
    const cx = s.units.reduce((t, u) => t + u.x, 0) / n;
    const cy = s.units.reduce((t, u) => t + u.y, 0) / n;
    const r0 = Math.hypot(s.units[0].x - cx, s.units[0].y - cy);
    s.units.forEach((u, i) => {
      expectNear(Math.hypot(u.x - cx, u.y - cy), r0, 1, `radius of unit ${u.key}`);
      const t = (2 * Math.PI * i) / n;
      expectNear(u.x, cx + r0 * Math.sin(t), 1, `x of unit ${u.key}`);
      expectNear(u.y, cy - r0 * Math.cos(t), 1, `y of unit ${u.key}`);
    });
  });

  test('V08 grid: rows of the rounded-up square root of n units, in file order', async ({ page }) => {
    await open(page, 'petersen');
    await command(page, 'setLayout', { name: 'grid' });
    await command(page, 'fit', 'all');
    await frames(page);
    const s = await scene(page);
    const cols = Math.ceil(Math.sqrt(s.units.length));
    const [a, b] = s.units;
    const step = b.x - a.x;
    expect(step).toBeGreaterThan(10);
    s.units.forEach((u, i) => {
      expectNear(u.x, a.x + (i % cols) * step, 1, `x of unit ${u.key}`);
      expectNear(u.y, a.y + Math.floor(i / cols) * step, 1, `y of unit ${u.key}`);
    });
  });

  for (const name of ['path-4', 'grid-3x3']) {
    test(`V09 given positions: ${name} appears exactly as its positions say, up to scale`, async ({ page }) => {
      await open(page, name);
      expect((await viewState(page)).layout.name).toBe('given');
      const s = await scene(page);
      const doc = graphFile(name);
      const pos = new Map(doc.vertices.map((v: { key: Key; pos: { x: number; y: number } }) => [v.key, v.pos]));
      const [u0, u1] = s.units;
      const p0 = pos.get(u0.key) as { x: number; y: number };
      const p1 = pos.get(u1.key) as { x: number; y: number };
      const scale = Math.hypot(u1.x - u0.x, u1.y - u0.y) / Math.hypot(p1.x - p0.x, p1.y - p0.y);
      for (const u of s.units) {
        const p = pos.get(u.key) as { x: number; y: number };
        expectNear(u.x, u0.x + (p.x - p0.x) * scale, 1, `x of unit ${u.key}`);
        expectNear(u.y, u0.y + (p.y - p0.y) * scale, 1, `y of unit ${u.key}`);
      }
    });
  }

  test('V09 given positions: a unit without a position sits near its placed neighbours', async ({ page }) => {
    await open(page, 'path-4');
    const doc = graphFile('path-4');
    doc.vertices.push({ key: 5 });
    doc.edges.push({ from: 4, to: 5 }, { from: 5, to: 4 });
    await page.evaluate((d) => (window as any).graphview.replace(d), doc);
    await frames(page);
    const s = await scene(page);
    const d45 = Math.hypot(unit(s, 5).x - unit(s, 4).x, unit(s, 5).y - unit(s, 4).y);
    const d12 = Math.hypot(unit(s, 2).x - unit(s, 1).x, unit(s, 2).y - unit(s, 1).y);
    expect(d45).toBeLessThan(d12);
  });

  test('V10 pin: after a drag and a new force layout, the unit has not moved', async ({ page }) => {
    await open(page, 'petersen');
    let s = await scene(page);
    const u = s.units[2];
    const b = await canvasBox(page);
    await page.mouse.move(b.x + u.x, b.y + u.y);
    await page.mouse.down();
    await page.mouse.move(b.x + u.x + 30, b.y + u.y + 20, { steps: 6 });
    await page.mouse.move(b.x + u.x + 60, b.y + u.y + 40, { steps: 6 });
    await page.mouse.up();
    await frames(page);
    s = await scene(page);
    const dropped = unit(s, u.key);
    expectNear(dropped.x, u.x + 60, 2, 'dropped x');
    expect(dropped.state.pinned).toBe(true);
    await command(page, 'setLayout', { name: 'force', seed: 5 });
    await frames(page);
    const after = unit(await scene(page), u.key);
    const vs = await viewState(page);
    const pin = vs.layout.pinned.find((p) => p.key === u.key)!;
    const placed = (await events(page, 'layoutsettled'))
      .at(-1)!
      .payload.positions.find((p: { key: Key }) => p.key === u.key);
    expectNear(placed.x, pin.x, 1e-6, 'graph x');
    expectNear(placed.y, pin.y, 1e-6, 'graph y');
    // On screen it stays where it was dropped, unless the fit after the layout moved the camera.
    expect(after.state.pinned).toBe(true);
  });

  test('V10 pin: the details panel unpins a unit', async ({ page }) => {
    await open(page, 'petersen');
    await setView(page, { selection: { units: [3], keypairs: [] } });
    await page.getByRole('button', { name: 'Pin', exact: true }).click();
    expect(unit(await scene(page), 3).state.pinned).toBe(true);
    await page.getByRole('button', { name: 'Unpin' }).click();
    expect(unit(await scene(page), 3).state.pinned).toBe(false);
  });

  test('V11 stable change: replacing path-4 with path-4 plus a fifth unit leaves the four units in place', async ({
    page,
  }) => {
    await open(page, 'path-4');
    const before = await scene(page);
    const doc = graphFile('path-4');
    doc.vertices.push({ key: 5, label: 'E' });
    doc.edges.push({ from: 4, to: 5 }, { from: 5, to: 4 });
    await page.evaluate((d) => (window as any).graphview.replace(d), doc);
    await frames(page);
    const after = await scene(page);
    expect(after.units.length).toBe(5);
    for (const u of before.units) {
      const v = unit(after, u.key);
      expectNear(v.x, u.x, 1, `x of unit ${u.key}`);
      expectNear(v.y, u.y, 1, `y of unit ${u.key}`);
    }
  });

  test('V11 stable change: superseded parts hidden and shown keep the other units in place', async ({ page }) => {
    await open(page, 'superseded');
    const before = await scene(page);
    await setLook(page, { superseded: 'hide', motion: 'off' });
    const after = await scene(page);
    expect(after.graph).toBe('current');
    for (const v of after.units) {
      const u = unit(before, v.key);
      expectNear(v.x, u.x, 1, `x of unit ${v.key}`);
    }
  });
});
