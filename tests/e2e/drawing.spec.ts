// The relation drawings in the browser (specification 6.18): the shell's invented family opens by
// perspectives, with boxes, ovals and two chevrons per relation; the viewer's bar switches the drawing;
// a chevron of the perspective drawing picks its perspective, which the inspector shows.
import { expect, test } from '@playwright/test';
import { call, click, close, open, pixel, read, rgb, settled, snap, unit, type Snap } from './helpers.ts';

const TWIN = 'classes-and-perspectives';
const dist = (p: { sx: number; sy: number }, q: { sx: number; sy: number }) => Math.hypot(p.sx - q.sx, p.sy - q.sy);

test('§6.18 Relation drawings: the invented family opens by perspectives; each relation through an interface has two chevrons, each pointing at the unit whose perspective it carries', async ({
  page,
}) => {
  await open(page, TWIN);
  const s = await snap(page);
  expect(s.drawing).toBe('perspectives');
  await expect(page.getByRole('combobox', { name: 'Drawing' })).toHaveValue('perspectives');
  expect(s.chevrons).toHaveLength(18);
  const twoEnds = s.chevrons.filter((c) => c.perspective && c.perspective.from !== c.perspective.to);
  expect(twoEnds).toHaveLength(16);
  for (const c of twoEnds) {
    // It sits on its own end's side of the interface, and the unit it carries the perspective of lies past the interface.
    expect(c.points).toBe(c.perspective!.from);
    expect(c.perspective!.to).toBe(c.from);
    expect(dist(c, unit(s, c.from))).toBeLessThan(dist(c, unit(s, c.to)));
    expect(dist(c, unit(s, c.points))).toBeGreaterThan(dist(c, unit(s, c.to)));
  }
  // An interface with one end has one chevron, pointing at its end.
  const def = s.chevrons.filter((c) => c.from === 'course-def' || c.to === 'course-def');
  expect(def.map((c) => [c.from, c.to, c.points, c.type])).toEqual([['course-def', 'course', 'course', 'defines']]);
  // Class units are boxes; interfaces are ovals in their type's colour, labelled with their class.
  expect(unit(s, 'course').shape).toBe('box');
  const oval = unit(s, 't-ada-algebra');
  expect(oval.shape).toBe('oval');
  expect(close(await pixel(page, oval.sx, oval.sy), rgb(oval.halves[0]))).toBe(true);
  expect(s.labels.map((l) => l.text)).toEqual(expect.arrayContaining(['Teaching', 'Membership', 'Course']));
  // The revision supersedes Algebra, which fades.
  expect(unit(s, 'algebra').opacity).toBeLessThan(0.5);
  expect(await read<unknown[]>(page, 'issues')).toEqual([]);
});

test('§6.18 Relation drawings: the bar switches to keypairs and back; the units stay where they are, in 2D and 3D', async ({
  page,
}) => {
  await open(page, TWIN);
  const where = (s: Snap) => s.units.map((u) => [u.key, Math.round(u.sx), Math.round(u.sy)]);
  const before = await snap(page);
  const menu = page.getByRole('combobox', { name: 'Drawing' });
  await menu.selectOption('keypairs');
  await settled(page);
  const keypairs = await snap(page);
  expect(keypairs.drawing).toBe('keypairs');
  expect(keypairs.chevrons).toHaveLength(36);
  expect([...new Set(keypairs.units.map((u) => u.shape))].sort()).toEqual(['disc', 'divided']);
  expect(where(keypairs)).toEqual(where(before));
  await menu.selectOption('perspectives');
  await settled(page);
  expect((await snap(page)).chevrons).toHaveLength(18);
  await call(page, 'setMode', '3d');
  const deep = await snap(page);
  expect(deep.mode).toBe('3d');
  expect(deep.chevrons.filter((c) => c.visible)).toHaveLength(18);
});

test('§6.18 and §7.4 Relation drawings: a chevron of the perspective drawing picks its perspective; the inspector shows its pair type, its keypairs and its ends', async ({
  page,
}) => {
  await open(page, TWIN);
  const s = await snap(page);
  // On Algebra's side of the teaching: Ada's perspective, pointing at Ada.
  const c = s.chevrons.find((x) => x.from === 'algebra' && x.to === 't-ada-algebra')!;
  expect([c.points, c.type]).toEqual(['ada', 'teaches']);
  await click(page, c.sx, c.sy);
  await expect
    .poll(() => read(page, 'inspected'))
    .toEqual({ kind: 'perspective', iface: 't-ada-algebra', from: 'ada', to: 'algebra' });
  const inspector = page.getByTestId('inspector');
  await expect(inspector.locator('h3')).toHaveText('Perspective from Ada to Algebra');
  await expect(inspector.locator('[data-field=perspective]')).toHaveText('teaches');
  await expect(inspector.locator('[data-field=interface]')).toHaveText('t-ada-algebra');
  await expect(inspector.locator('h4')).toHaveText(['Ada to t-ada-algebra', 't-ada-algebra to Algebra']);
  await expect(inspector.locator('[data-col] [data-field=type]')).toHaveText(['teaches', 'teaches']);
  await expect(page.getByTestId('live')).toHaveText('Inspecting perspective from Ada to Algebra');
});
