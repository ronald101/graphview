// The viewer (specification sections 6 and 7), in the shell's production build: one
// view in 2D and 3D, the root and its planes, paths, three click targets per line, filters, types,
// display overrides, hulls, issues and the keyboard.
import { expect, test, type Page } from '@playwright/test';
import { pathSet, ringIndex } from '../../module/core/index.ts';
import { DEPTH_RULES, depthState, FOREGROUND, plane, SPACING } from '../../module/model/depth.ts';
import {
  call,
  chevron,
  click,
  close,
  expected,
  frames,
  graphOf,
  lineOf,
  longestLine,
  open,
  pickAt,
  pixel,
  read,
  rgb,
  SAMPLE_SOURCE,
  settled,
  slide,
  snap,
  unit,
  type Key,
  type Snap,
} from './helpers.ts';

const name = (k: Key) => `unit_${k}`;
const LIMITS = { count: 10000, list: 200, timeMs: 2000 };
const onPath = (s: Snap) =>
  s.units
    .filter((u) => u.onPath)
    .map((u) => u.key)
    .sort();

/** Makes a unit the root by clicking it, and waits for the planes. */
async function clickRoot(page: Page, key: Key) {
  const s = await snap(page);
  await click(page, unit(s, key).sx, unit(s, key).sy);
  await expect.poll(async () => (await snap(page)).root).toBe(key);
  await settled(page);
}

test('§6.2 Drawing: each relation is one line; each keypair is one chevron, a third of the way from its first unit, in its type colour', async ({
  page,
}) => {
  await open(page);
  const s = await snap(page);
  const doc = await read<{ edges: { from: Key; to: Key; attrs: { type: string } }[] }>(page, 'doc');
  const types = await read<{ keypair: { id: string; colour: string }[] }>(page, 'types');
  expect(s.units).toHaveLength(81);
  expect(s.chevrons).toHaveLength(doc.edges.length);
  expect(s.lines).toHaveLength(expected(SAMPLE_SOURCE).counts.relations);
  for (const l of s.lines) {
    expect(l.keypairs).toEqual([true, true]);
    expect(chevron(s, l.a, l.b).at).toBeCloseTo(1 / 3);
    expect(chevron(s, l.b, l.a).at).toBeCloseTo(2 / 3);
  }
  for (const c of s.chevrons) {
    const row = doc.edges.find((e) => e.from === c.from && e.to === c.to)!;
    expect(c.type).toBe(row.attrs.type);
    expect(c.colour).toBe(types.keypair.find((t) => t.id === c.type)!.colour);
  }
  await expect(page.getByRole('application')).toHaveAccessibleName('Graph in 2D: 81 units, 84 relations');
});

test('§6.3 2D and 3D: in 2D a root keeps every unit on one plane, with the sizes, opacities and colours of 3D; the 3D button moves them back', async ({
  page,
}) => {
  await open(page);
  await clickRoot(page, 1);
  const ring = ringIndex(graphOf(SAMPLE_SOURCE), 1);
  let s = await snap(page);
  expect(s.mode).toBe('2d');
  const counts = { first: 0, second: 0, third: 0, far: 0 };
  s.units.forEach((u, i) => {
    const want = depthState({ degree: ring[i], onPath: false, hasRoot: true, hasPath: false, depth: false });
    expect(u.degree).toBe(ring[i]);
    expect(u.z).toBe(0);
    expect(u.scale).toBeCloseTo(want.scale, 5);
    expect(u.opacity).toBeCloseTo(want.opacity, 5);
    if (ring[i] > 0) counts[(['first', 'second', 'third'] as const)[plane(ring[i])] ?? 'far']++;
  });
  // Lines fade with the units they join.
  for (const l of s.lines) expect(l.opacity).toBeCloseTo((unit(s, l.a).opacity + unit(s, l.b).opacity) / 2, 5);
  await expect(page.getByLabel('Root', { exact: true })).toHaveValue(name(1));
  await expect(page.getByTestId('plane-first')).toHaveText(String(counts.first));
  await expect(page.getByTestId('plane-second')).toHaveText(String(counts.second));
  await expect(page.getByTestId('plane-third')).toHaveText(String(counts.third));
  await expect(page.getByTestId('plane-far')).toHaveText(String(counts.far));
  await expect(page.getByTestId('deepest')).toHaveText(String(Math.max(...ring)));

  await page.getByRole('button', { name: '3D', exact: true }).click();
  await settled(page);
  s = await snap(page);
  expect(s.mode).toBe('3d');
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  s.units.forEach((u, i) => {
    const d = ring[i];
    if (d <= 1) expect([u.z, u.scale, u.opacity]).toEqual([0, 1, 1]);
    else if (d === 2) expect([u.z, u.scale, u.opacity]).toEqual([-SPACING, 0.6, 0.6]);
    else {
      expect(u.z).toBe(-SPACING * Math.min(DEPTH_RULES.maxPlanes, d - 1));
      expect(u.scale).toBeCloseTo(DEPTH_RULES.far.scale, 5);
      expect(u.opacity).toBeCloseTo(DEPTH_RULES.far.opacity, 5);
    }
  });
  await expect(page.getByRole('application')).toHaveAccessibleName('Graph in 3D: 81 units, 84 relations');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await settled(page);
  expect((await snap(page)).units.every((u) => u.z === 0)).toBe(true);
  expect((await snap(page)).root).toBe(1);
});

test('§6.3 2D and 3D: clicks never switch between 2D and 3D', async ({ page }) => {
  await open(page);
  for (const mode of ['2d', '3d'] as const) {
    await call(page, 'setMode', mode);
    const s = await snap(page);
    const { line } = longestLine(s);
    const c = chevron(s, line.a, line.b);
    for (const [x, y, shift] of [
      [unit(s, 5).sx, unit(s, 5).sy, false],
      [c.sx, c.sy, false],
      [line.sx, line.sy, false],
      [unit(s, 7).sx, unit(s, 7).sy, true],
      [3, 3, false],
    ] as const) {
      await click(page, x, y, shift);
      expect((await snap(page)).mode).toBe(mode);
    }
  }
});

test('§7.2 Root and depth: the field sets the root by label or key; Reset clears the field and the inspector', async ({
  page,
}) => {
  await open(page);
  const field = page.getByLabel('Root', { exact: true });
  await expect(page.getByTestId('plane-first')).toHaveText('none');
  await expect(page.getByTestId('deepest')).toHaveText('none');
  await field.fill(name(79));
  await page.getByTestId('root-panel').getByRole('button', { name: 'Set', exact: true }).click();
  await expect.poll(async () => (await snap(page)).root).toBe(79);
  await expect(page.getByTestId('inspector')).toContainText(name(79));
  await field.fill('77');
  await field.press('Enter');
  await expect.poll(async () => (await snap(page)).root).toBe(77);
  // The text "1" names no unit: the sample's keys are numbers.
  await field.fill('"1"');
  await field.press('Enter');
  await expect(page.getByTestId('root-panel')).toContainText('No unit has the label or key "1".');
  expect((await snap(page)).root).toBe(77);
  await page.getByTestId('root-panel').getByRole('button', { name: 'Reset' }).click();
  await expect.poll(async () => (await snap(page)).root).toBe(null);
  await expect(field).toHaveValue('');
  await expect(page.getByTestId('inspector').locator('h3, dl')).toHaveCount(0);
  await expect(page.getByTestId('plane-far')).toHaveText('none');
});

test('§6.11 Picking: a unit on a far plane answers a click; deeper units reach further', async ({ page }) => {
  await open(page);
  await call(page, 'setMode', '3d');
  await clickRoot(page, 1);
  // The canvas is narrower than tall, so Fit sizes the graph by its width; one step closer gives
  // the units on screen the spacing these probes need.
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('=');
  await settled(page);
  const s = await snap(page);
  for (const u of s.units) expect(u.reach).toBeGreaterThanOrEqual([6, 8, 10, 12][Math.min(3, u.plane ?? 0)]);
  const inside = (u: Snap['units'][number]) => u.sx > 20 && u.sy > 20 && u.sx < s.width - 20 && u.sy < s.height - 20;
  const deep = s.units.filter((u) => (u.plane ?? 0) >= 3 && u.visible && inside(u));
  expect(deep.length).toBeGreaterThan(0);
  // Every unit on the fourth plane or deeper answers a click on its centre, unless a unit in front is drawn there.
  let own = 0;
  for (const u of deep) {
    const hit = (await pickAt(page, u.sx, u.sy)) as { kind: string; key: Key };
    expect(hit.kind, `unit ${u.key}`).toBe('unit');
    if (hit.key === u.key) own++;
    else {
      const v = unit(s, hit.key);
      expect(v.z, `unit ${v.key} in front of unit ${u.key}`).toBeGreaterThan(u.z);
      expect(Math.hypot(v.sx - u.sx, v.sy - u.sy)).toBeLessThan(v.reach);
    }
  }
  expect(own).toBeGreaterThan(deep.length / 2);
  // The one furthest from its neighbours answers a click well past its drawing: no other unit is nearer there.
  const others = (u: Snap['units'][number]) => s.units.filter((v) => v !== u);
  const gap = (u: Snap['units'][number]) => Math.min(...others(u).map((v) => Math.hypot(v.sx - u.sx, v.sy - u.sy)));
  const far = deep.reduce((a, b) => (gap(b) > gap(a) ? b : a));
  const r = Math.min(far.reach - 1, gap(far) / 2 - 1);
  expect(r).toBeGreaterThanOrEqual(8);
  const next = others(far).find((v) => Math.hypot(v.sx - far.sx, v.sy - far.sy) === gap(far))!;
  const [dx, dy] = [far.sx - next.sx, far.sy - next.sy].map((d) => d / gap(far));
  expect(await pickAt(page, far.sx + r * dx, far.sy + r * dy)).toEqual({ kind: 'unit', key: far.key });
  await click(page, far.sx, far.sy);
  await expect.poll(async () => (await snap(page)).root).toBe(far.key);
  expect(await read(page, 'inspected')).toEqual({ kind: 'unit', key: far.key });
});

test('§6.5 and §7.3 Paths: Shift-click finds the shortest path and those one and two steps longer; the menu, the table and the fields follow', async ({
  page,
}) => {
  await open(page);
  await call(page, 'setMode', '3d');
  await clickRoot(page, 79);
  let s = await snap(page);
  await click(page, unit(s, 77).sx, unit(s, 77).sy, true);
  await expect.poll(async () => (await snap(page)).hasPath).toBe(true);
  await settled(page);
  const want = pathSet(graphOf(SAMPLE_SOURCE), 79, 77, 2, LIMITS);
  const panel = page.getByTestId('paths-panel');
  await expect(page.getByLabel('Paths to')).toHaveValue(name(77));
  await expect(panel.getByTestId('path-ends')).toHaveText(`From ${name(79)} to ${name(77)}`);
  const groups = await panel
    .locator('[data-testid=path-choice] optgroup')
    .evaluateAll((els) => els.map((e) => e.getAttribute('label')));
  expect(groups).toHaveLength(want.lengths.length);
  want.lengths.forEach((l, n) =>
    expect(groups[n]).toContain(`${n === 0 ? 'Shortest' : `Shortest + ${n}`}: length ${l.length}`),
  );
  const path = want.lengths[0].paths[0];
  await expect(panel.getByTestId('path-choice')).toHaveValue(`${want.lengths[0].length}:0`);
  await expect(panel.locator('[data-testid=path-table] tbody th')).toHaveText(path.map(name));
  s = await snap(page);
  for (const u of s.units) {
    if (path.includes(u.key as number))
      expect([u.onPath, u.z, u.scale, u.opacity, u.glow]).toEqual([true, FOREGROUND, 1.2, 1, 1]);
    else expect(u.opacity).toBeCloseTo(DEPTH_RULES.dimmed, 5);
  }
  for (let i = 0; i + 1 < path.length; i++) {
    expect(lineOf(s, path[i], path[i + 1]).onPath).toBe(true);
    // The chevron along the travel direction stays lit; the opposing one dims.
    expect(chevron(s, path[i], path[i + 1]).flow).toBe(1);
    expect(chevron(s, path[i + 1], path[i]).flow).toBe(-1);
  }
  // A path one step longer, from the menu.
  const longer = want.lengths[1].paths[0];
  await panel.getByTestId('path-choice').selectOption(`${want.lengths[1].length}:0`);
  await settled(page);
  expect(onPath(await snap(page))).toEqual([...longer].sort());
  await expect(panel.locator('[data-testid=path-table] tbody th')).toHaveText(longer.map(name));
  // Reverse: the ends swap, and the paths run back.
  await panel.getByRole('button', { name: 'Reverse path' }).click();
  await expect.poll(async () => [(await snap(page)).root, (await snap(page)).target]).toEqual([77, 79]);
  await expect(page.getByLabel('Root', { exact: true })).toHaveValue(name(77));
  await expect(page.getByLabel('Paths to')).toHaveValue(name(79));
  // Reset clears the target's field and the inspector, and keeps the root.
  await panel.getByRole('button', { name: 'Reset' }).click();
  await expect.poll(async () => (await snap(page)).hasPath).toBe(false);
  await expect(page.getByLabel('Paths to')).toHaveValue('');
  expect(await read(page, 'inspected')).toBe(null);
  expect((await snap(page)).root).toBe(77);
});

test('§7.3 Paths: the field finds the target by label or by key; Escape clears the path, then the root', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Paths to').fill(name(77));
  await page.getByLabel('Paths to').press('Enter');
  await expect(page.getByTestId('paths-panel')).toContainText('Set a root first');
  await page.getByLabel('Root', { exact: true }).fill(name(79));
  await page.getByLabel('Root', { exact: true }).press('Enter');
  await expect.poll(async () => (await snap(page)).root).toBe(79);
  await page.getByLabel('Paths to').fill('77');
  await page.getByLabel('Paths to').press('Enter');
  await expect.poll(async () => (await snap(page)).hasPath).toBe(true);
  await settled(page);
  expect(onPath(await snap(page))).toEqual(
    [...pathSet(graphOf(SAMPLE_SOURCE), 79, 77, 2, LIMITS).lengths[0].paths[0]].sort(),
  );
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snap(page)).hasPath).toBe(false);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snap(page)).root).toBe(null);
});

test('§6.11 and §7.4 Picking and the inspector (G11): three click targets on one line: the forward chevron, the backward chevron and the line', async ({
  page,
}) => {
  await open(page);
  await call(page, 'setMode', '3d');
  const s = await snap(page);
  const { line, length } = longestLine(s);
  expect(length).toBeGreaterThan(100);
  const doc = await read<{ edges: { from: Key; to: Key; attrs: { type: string } }[] }>(page, 'doc');
  const type = (a: Key, b: Key) => doc.edges.find((e) => e.from === a && e.to === b)!.attrs.type;
  const inspector = page.getByTestId('inspector');

  const f = chevron(s, line.a, line.b);
  await click(page, f.sx, f.sy);
  expect(await read(page, 'inspected')).toEqual({ kind: 'keypair', from: line.a, to: line.b });
  await expect(inspector.locator('h3')).toHaveText(`Keypair from ${name(line.a)} to ${name(line.b)}`);
  await expect(inspector.locator('[data-field=type]').first()).toHaveText(type(line.a, line.b));

  const b = chevron(s, line.b, line.a);
  await click(page, b.sx, b.sy);
  expect(await read(page, 'inspected')).toEqual({ kind: 'keypair', from: line.b, to: line.a });

  await click(page, line.sx, line.sy);
  expect(await read(page, 'inspected')).toEqual({ kind: 'relation', a: line.a, b: line.b });
  await expect(inspector.locator('h3').first()).toHaveText(`Relation between ${name(line.a)} and ${name(line.b)}`);
  await expect(inspector.locator('[data-col="0"] [data-field=type]')).toHaveText(type(line.a, line.b));
  await expect(inspector.locator('[data-col="1"] [data-field=type]')).toHaveText(type(line.b, line.a));
  // None of these clicks changed the root.
  expect((await snap(page)).root).toBe(null);
});

test('§6.11 Picking (G11): the hit zones reach past the drawing: a click beside a chevron or a line still picks it', async ({
  page,
}) => {
  await open(page);
  const s = await snap(page);
  const { line } = longestLine(s);
  const a = unit(s, line.a);
  const b = unit(s, line.b);
  const len = Math.hypot(b.sx - a.sx, b.sy - a.sy);
  const [nx, ny] = [-(b.sy - a.sy) / len, (b.sx - a.sx) / len];
  const f = chevron(s, line.a, line.b);
  for (const side of [-1, 1]) {
    expect(await pickAt(page, f.sx + side * 7 * nx, f.sy + side * 7 * ny)).toEqual({
      kind: 'keypair',
      from: line.a,
      to: line.b,
    });
    expect(await pickAt(page, line.sx + side * 5 * nx, line.sy + side * 5 * ny)).toEqual({
      kind: 'relation',
      a: line.a,
      b: line.b,
    });
  }
  expect(await pickAt(page, 2, 2)).toBeNull();
});

test('§6.7 and §7.5 Filters: lines below the weight threshold stay thin and grey without chevrons; lines above grow with the weight', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as any).graphview.generate('communities', { n: 40, g: 4, pIn: 0.3, pOut: 0.02 }, 3, undefined, true),
  );
  await settled(page);
  expect((await snap(page)).units).toHaveLength(40);
  await expect(page.getByTestId('filters-panel')).toContainText('Threshold off');
  await expect(page.getByTestId('filters-panel')).not.toContainText('At least');
  await slide(page, 'Weight threshold', 0.6);
  await settled(page);
  const s = await snap(page);
  const above = s.lines.filter((l) => l.above);
  expect(above.length).toBeGreaterThan(0);
  expect(above.length).toBeLessThan(s.lines.length);
  for (const c of s.chevrons) expect(c.visible).toBe(lineOf(s, c.from, c.to).above);
  const sorted = [...above].sort((p, q) => p.strength - q.strength);
  expect(sorted[0].strength).toBeGreaterThan(0.5);
  expect(sorted.at(-1)!.strength).toBeLessThanOrEqual(1);
  const threshold = (await read<{ threshold: number }>(page, 'filters')).threshold;
  expect(threshold).toBeCloseTo(0.6, 1);
  await expect(page.getByTestId('filters-panel')).toContainText(`At least ${+threshold.toFixed(3)}`);
});

test('§6.7 Filters: the time window and the weight threshold compound; rows that enter the window fade in', async ({
  page,
}) => {
  await open(page, undefined, { motion: 'on' });
  await page.evaluate(() => (window as any).graphview.generate('cycle', { n: 24 }, 7, undefined, true));
  await settled(page);
  let s = await snap(page);
  expect(s.units.every((u) => u.visible)).toBe(true);
  const times = (await read<{ vertices: { attrs: { created: string } }[] }>(page, 'doc')).vertices
    .map((v) => Date.parse(v.attrs.created))
    .sort((a, b) => a - b);
  await call(page, 'setFilters', { to: times[12], threshold: 0.5 });
  s = await snap(page);
  const shown = s.units.filter((u) => u.visible).length;
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(24);
  for (const c of s.chevrons) {
    if (!c.visible) continue;
    expect(unit(s, c.from).visible && unit(s, c.to).visible).toBe(true);
    expect(lineOf(s, c.from, c.to).above).toBe(true);
  }
  // Widen the window: the new rows fade in rather than appear at once.
  const seen = (await page.evaluate(async () => {
    const g = (window as any).graphview;
    g.model.setFilters({ to: null });
    const out: number[][] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      await new Promise((r) => requestAnimationFrame(r));
      out.push(
        g
          .canvas()
          .getScene()
          .units.map((x: { opacity: number }) => x.opacity),
      );
    }
    return out;
  })) as number[][];
  const entering = seen[0].map((_, i) => i).filter((i) => seen[0][i] < 0.5);
  expect(entering.length).toBeGreaterThan(0);
  expect(seen.some((frame) => entering.some((i) => frame[i] > 0.05 && frame[i] < 0.95))).toBe(true);
  await settled(page);
  expect((await snap(page)).units.every((u) => u.visible && u.opacity === 1)).toBe(true);
});

test('§6.6 Types and palette: a new colour reaches the picture through the palette, in 2D and 3D, without moving a unit', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('section-types').getByRole('button', { name: 'Types' }).click();
  const types = await read<{ unit: { id: string; label: string; colour: string }[] }>(page, 'types');
  const t = types.unit[0];
  const s = await snap(page);
  const u = s.units.find((x) => x.type === t.id && x.visible)!;
  expect(close(await pixel(page, u.sx, u.sy), rgb(t.colour))).toBe(true);
  await page.getByLabel(`Colour of the unit type ${t.label}`).fill('#ff00ff');
  await frames(page);
  expect(close(await pixel(page, u.sx, u.sy), [255, 0, 255])).toBe(true);
  expect((await snap(page)).units.map((x) => [x.key, x.sx, x.sy])).toEqual(s.units.map((x) => [x.key, x.sx, x.sy]));
  await call(page, 'setMode', '3d');
  const v = unit(await snap(page), u.key);
  expect(close(await pixel(page, v.sx, v.sy), [255, 0, 255])).toBe(true);
});

test('§7.7 Types: a renamed type shows in the inspector and the path table', async ({ page }) => {
  await open(page);
  await page.getByTestId('section-types').getByRole('button', { name: 'Types' }).click();
  const doc = await read<{ edges: { from: Key; to: Key; attrs: { type: string } }[] }>(page, 'doc');
  const first = doc.edges[0];
  await page.getByLabel(`Name of the keypair type ${first.attrs.type}`).fill('owns');
  await page.getByLabel(`Name of the keypair type ${first.attrs.type}`).blur();
  await call(page, 'inspect', { kind: 'keypair', from: first.from, to: first.to });
  await expect(page.getByTestId('inspector').locator('[data-field=type]').first()).toHaveText(
    `owns (${first.attrs.type})`,
  );
  await call(page, 'setRoot', first.from);
  await call(page, 'setTarget', first.to);
  await expect(page.locator('[data-testid=path-table] tbody td').first()).toHaveText('owns');
});

test('§6.8 and §7.6 Display: unit size and opacity change in the shaders', async ({ page }) => {
  await open(page);
  await page.getByTestId('section-display').getByRole('button', { name: 'Display' }).click();
  const s = await snap(page);
  const bg = await pixel(page, 2, 2);
  let spot: { x: number; y: number; dx: number; dy: number } | null = null;
  for (const u of s.units) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (!spot && close(await pixel(page, u.sx + 9 * dx, u.sy + 9 * dy), bg, 4)) spot = { x: u.sx, y: u.sy, dx, dy };
    }
    if (spot) break;
  }
  expect(spot).not.toBeNull();
  const { x, y, dx, dy } = spot!;
  await slide(page, 'Unit size', 3);
  await frames(page);
  expect(close(await pixel(page, x + 9 * dx, y + 9 * dy), bg, 4)).toBe(false);
  await slide(page, 'Unit size', 1);
  await frames(page);
  const full = await pixel(page, x + 2 * dx, y + 2 * dy);
  await slide(page, 'Opacity', 0.3);
  await frames(page);
  const faint = await pixel(page, x + 2 * dx, y + 2 * dy);
  const gap = (c: number[]) => c.reduce((sum, v, i) => sum + Math.abs(v - bg[i]), 0);
  expect(gap(full)).toBeGreaterThan(60);
  expect(gap(faint)).toBeLessThan(gap(full) * 0.45);
});

test('§6.8 Display overrides: the line-width factor widens the lines in pixels', async ({ page }) => {
  await open(page);
  const s = await snap(page);
  const { line } = longestLine(s);
  const [a, b] = [unit(s, line.a), unit(s, line.b)];
  const length = Math.hypot(b.sx - a.sx, b.sy - a.sy);
  const [nx, ny] = [-(b.sy - a.sy) / length, (b.sx - a.sx) / length];
  const bg = await pixel(page, 2, 2);
  // The pixels across the line's middle that differ from the background.
  const across = async () => {
    let n = 0;
    for (let t = -8; t <= 8; t++) if (!close(await pixel(page, line.sx + t * nx, line.sy + t * ny), bg, 12)) n++;
    return n;
  };
  const thin = await across();
  await page.getByTestId('section-display').getByRole('button', { name: 'Display' }).click();
  await slide(page, 'Line width', 3);
  await frames(page);
  const wide = await across();
  expect(thin).toBeGreaterThan(0);
  expect(wide).toBeGreaterThanOrEqual(thin + 2);
});

test('§6.10 Transitions: with Motion "As the system", reduced motion makes changes instant; Motion on eases them', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, undefined, { motion: 'system' });
  await call(page, 'setMode', '3d');
  // Whether the scene has settled right after a new root, before any frame.
  const settledAfterRoot = (key: Key) =>
    page.evaluate(async (k) => {
      const g = (window as any).graphview;
      await g.model.setRoot(k);
      return g.canvas().getScene().settled as boolean;
    }, key);
  expect(await settledAfterRoot(1)).toBe(true);
  await page.evaluate(() => (window as any).graphview.setLook({ motion: 'on' }));
  await frames(page);
  expect(await settledAfterRoot(79)).toBe(false);
  await settled(page);
  expect((await snap(page)).root).toBe(79);
});

test('§6.9 Hulls: they wrap close units of one type; the switch in the top bar turns them off and on', async ({
  page,
}) => {
  await open(page);
  const s = await snap(page);
  const types = (await read<{ unit: { id: string }[] }>(page, 'types')).unit.map((t) => t.id);
  expect(s.hulls.length).toBeGreaterThan(0);
  for (const h of s.hulls) {
    expect(h.members).toBeGreaterThanOrEqual(3);
    expect(types).toContain(h.type);
  }
  const toggle = page.getByRole('toolbar', { name: 'View' }).getByLabel('Hulls');
  await toggle.uncheck();
  await frames(page);
  expect((await snap(page)).hulls).toEqual([]);
  await toggle.check();
  await frames(page);
  expect((await snap(page)).hulls).toEqual(s.hulls);
  // A path dims the hulls with the other units; in 2D the units stay where they are, and in their hulls.
  await call(page, 'setRoot', 79);
  await call(page, 'setTarget', 77);
  const withPath = await snap(page);
  const groups = (h: Snap['hulls']) => h.map(({ type, members }) => ({ type, members }));
  expect(withPath.hasPath).toBe(true);
  expect(groups(withPath.hulls)).toEqual(groups(s.hulls));
  expect(withPath.hulls[0].opacity).toBeCloseTo(s.hulls[0].opacity * DEPTH_RULES.dimmed, 4);
});

test('§6.13 and §7.8 Issues: a broken graph lists its issues; a keypair without its reverse keeps one chevron', async ({
  page,
}) => {
  await open(page, 'broken-mixed');
  const want = expected('broken-mixed').issues.map((i: { code: string }) => i.code);
  const codes = await page
    .getByTestId('issues-panel')
    .locator('li')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-code')));
  expect(codes.sort()).toEqual([...want].sort());
  const s = await snap(page);
  const missing = expected('broken-mixed').issues.find((i: { code: string }) => i.code === 'missing-reverse')
    .keypair as [Key, Key];
  const l = lineOf(s, missing[0], missing[1]);
  expect(l.keypairs.filter(Boolean)).toHaveLength(1);
  expect(s.chevrons.filter((c) => (c.from === l.a && c.to === l.b) || (c.from === l.b && c.to === l.a))).toHaveLength(
    1,
  );
});

test('§6.14 Keyboard: arrows pan, + and − zoom, [ and ] turn in 3D, 0 fits; Tab steps through keypairs; Enter and F act', async ({
  page,
}) => {
  await open(page);
  const canvas = page.getByTestId('canvas');
  await canvas.focus();
  const cam = () => page.evaluate(() => (window as any).graphview.canvas().getCamera());
  const c0 = await cam();
  await page.keyboard.press('ArrowRight');
  expect((await cam()).target[0]).toBeGreaterThan(c0.target[0]);
  await page.keyboard.press('ArrowUp');
  expect((await cam()).target[1]).toBeGreaterThan(c0.target[1]);
  const dist = (c: { position: number[]; target: number[] }) =>
    Math.hypot(...c.position.map((p: number, i: number) => p - c.target[i]));
  await page.keyboard.press('=');
  expect(dist(await cam())).toBeLessThan(dist(c0));
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  expect(dist(await cam())).toBeGreaterThan(dist(c0));
  // 2D does not turn; 3D turns around the vertical.
  const flat = await cam();
  await page.keyboard.press(']');
  expect(await cam()).toEqual(flat);
  await call(page, 'setMode', '3d');
  await canvas.focus();
  const before = await cam();
  await page.keyboard.press(']');
  expect((await cam()).position[0]).not.toBeCloseTo(before.position[0], 3);
  await page.keyboard.press('0');
  expect((await cam()).target).toEqual([0, 0, 0]);

  // Tab steps through a unit's keypairs: outgoing first, then incoming, each in file order.
  await call(page, 'inspect', { kind: 'unit', key: 79 });
  await canvas.focus();
  const doc = await read<{ edges: { from: Key; to: Key }[] }>(page, 'doc');
  const order = [...doc.edges.filter((e) => e.from === 79), ...doc.edges.filter((e) => e.to === 79)];
  for (const e of order.slice(0, 3)) {
    await page.keyboard.press('Tab');
    expect(await read(page, 'inspected')).toEqual({ kind: 'keypair', from: e.from, to: e.to });
  }
  await page.keyboard.press('Shift+Tab');
  expect(await read(page, 'inspected')).toEqual({ kind: 'keypair', from: order[1].from, to: order[1].to });
  // Enter moves to the keypair's far unit; Enter again makes it the root.
  await page.keyboard.press('Enter');
  expect(await read(page, 'inspected')).toEqual({ kind: 'unit', key: order[1].to });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snap(page)).root).toBe(order[1].to);
  // F makes the inspected unit the root; Shift and Enter make it the path's target.
  await call(page, 'inspect', { kind: 'unit', key: 79 });
  await canvas.focus();
  await page.keyboard.press('f');
  await expect.poll(async () => (await snap(page)).root).toBe(79);
  await call(page, 'inspect', { kind: 'unit', key: 77 });
  await canvas.focus();
  await page.keyboard.press('Shift+Enter');
  await expect.poll(async () => (await snap(page)).target).toBe(77);
  // / opens the search field (6.19).
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox', { name: 'Search' })).toBeFocused();
});

test('§6.14 Live region: it says what changed, in words', async ({ page }) => {
  await open(page);
  const live = page.getByTestId('live');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await call(page, 'setRoot', 79);
  await expect(live).toHaveText(`Root ${name(79)}`);
  await call(page, 'setTarget', 77);
  await expect(live).toContainText(`Shortest path from ${name(79)} to ${name(77)}`);
  const doc = await read<{ edges: { from: Key; to: Key }[] }>(page, 'doc');
  const e = doc.edges.find((x) => x.from === 79)!;
  await call(page, 'inspect', { kind: 'keypair', from: e.from, to: e.to });
  await expect(live).toHaveText(`Inspecting keypair from ${name(e.from)} to ${name(e.to)}`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(live).toHaveText('3D view');
});

test('§6.14 Live region: a click on a unit says "Root …" once, not the inspection that comes with it; one step is "1 step"', async ({
  page,
}) => {
  await open(page);
  const live = page.getByTestId('live');
  const s = await snap(page);
  await click(page, unit(s, 79).sx, unit(s, 79).sy);
  await expect.poll(async () => (await snap(page)).root).toBe(79);
  await expect(live).toHaveText(`Root ${name(79)}`);
  await page.waitForTimeout(300);
  await expect(live).toHaveText(`Root ${name(79)}`);
  const doc = await read<{ edges: { from: Key; to: Key }[] }>(page, 'doc');
  const next = doc.edges.find((x) => x.from === 79)!.to;
  await call(page, 'setTarget', next);
  await expect(live).toHaveText(`Shortest path from ${name(79)} to ${name(next)}: 1 step`);
});

test('§6.11 Picking: a unit drawn fainter than 0.1, the display opacity included, answers no click', async ({
  page,
}) => {
  await open(page);
  await call(page, 'setMode', '3d');
  await call(page, 'setRoot', 1);
  let s = await snap(page);
  const inside = (u: Snap['units'][number]) => u.sx > 20 && u.sy > 20 && u.sx < s.width - 20 && u.sy < s.height - 20;
  let deep: Snap['units'][number] | undefined;
  for (const u of s.units.filter((u) => (u.plane ?? 0) >= 3 && u.visible && inside(u))) {
    if ((await pickAt(page, u.sx, u.sy))?.key === u.key) {
      deep = u;
      break;
    }
  }
  expect(deep).toBeDefined();
  await call(page, 'setOverrides', { opacity: 0.25 });
  s = await snap(page);
  expect(unit(s, deep!.key).opacity).toBeLessThan(0.1);
  expect(await pickAt(page, deep!.sx, deep!.sy)).not.toEqual({ kind: 'unit', key: deep!.key });
  expect(await pickAt(page, unit(s, 1).sx, unit(s, 1).sy)).toEqual({ kind: 'unit', key: 1 });
});

test('§6.12 Labels: the inspected unit keeps its label on a far plane, where faint units have none', async ({
  page,
}) => {
  await open(page);
  await call(page, 'setMode', '3d');
  await call(page, 'setRoot', 1);
  let s = await snap(page);
  const inside = (u: Snap['units'][number]) => u.sx > 40 && u.sy > 40 && u.sx < s.width - 40 && u.sy < s.height - 40;
  const far = s.units.find((u) => (u.plane ?? 0) >= 3 && u.visible && u.opacity < 0.35 && inside(u))!;
  expect(s.labels.map((l) => l.key)).not.toContain(far.key);
  await call(page, 'inspect', { kind: 'unit', key: far.key });
  await frames(page);
  s = await snap(page);
  expect(s.labels.map((l) => l.key)).toContain(far.key);
  // Superseded units draw at 35 percent, the least opacity a label needs, and keep their labels.
  await page.evaluate(() => (window as any).graphview.loadExample('superseded'));
  await settled(page);
  expect((await snap(page)).labels.map((l) => l.key)).toEqual(expect.arrayContaining([3, 6]));
});

test('§6.13 Issues in the picture: a superseded keypair fades its own chevron; the line fades when both keypairs are superseded', async ({
  page,
}) => {
  await open(page);
  await call(page, 'load', {
    format: 'graphview-graph/1',
    vertices: [1, 2, 3].map((key) => ({ key })),
    edges: [
      { from: 1, to: 2, superseded: true },
      { from: 2, to: 1 },
      { from: 2, to: 3, superseded: true },
      { from: 3, to: 2, superseded: true },
      { from: 3, to: 1 },
      { from: 1, to: 3 },
    ],
  });
  const s = await snap(page);
  expect(chevron(s, 1, 2).opacity / chevron(s, 2, 1).opacity).toBeCloseTo(0.35, 2);
  expect(chevron(s, 3, 1).opacity).toBeCloseTo(chevron(s, 1, 3).opacity, 5);
  expect(lineOf(s, 1, 2).opacity).toBeCloseTo(lineOf(s, 3, 1).opacity, 5);
  expect(lineOf(s, 2, 3).opacity / lineOf(s, 3, 1).opacity).toBeCloseTo(0.35, 2);
});

test('§6.3 2D and 3D: Fit on a canvas narrower than tall shows the whole graph', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await open(page);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await settled(page);
  const s = await snap(page);
  expect(s.width).toBeLessThan(s.height);
  for (const u of s.units) {
    expect(u.sx, `unit ${u.key}`).toBeGreaterThan(0);
    expect(u.sx, `unit ${u.key}`).toBeLessThan(s.width);
    expect(u.sy, `unit ${u.key}`).toBeGreaterThan(0);
    expect(u.sy, `unit ${u.key}`).toBeLessThan(s.height);
  }
});
