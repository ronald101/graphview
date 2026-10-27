// Interface graphs in the browser: the examples, the divided disc in 2D and 3D, the inspector, the
// issues and the Generate setting (specification 3.8, 6.17, 7.4, 7.8 and 8.16).
import { expect, test, type Page } from '@playwright/test';
import { call, close, open, pixel, rgb, settled, snap, unit, type Key } from './helpers.ts';

/** Moves the camera close to a unit: straight above it, or from the side for 3D. */
async function zoomOn(page: Page, key: Key, distance: number, tilt = false) {
  await page.evaluate(
    ([k, d, t]) => {
      const c = (window as any).graphview.canvas();
      const u = c.getScene().units.find((x: { key: Key }) => x.key === k);
      const at = [u.x, u.y, u.z];
      c.setCamera(t ? [at[0] + d * 0.45, at[1] - d * 0.4, at[2] + d * 0.8] : [at[0], at[1], at[2] + d], at);
    },
    [key, distance, tilt] as const,
  );
  await settled(page);
}

/** The colours drawn inside an interface's disc, toward each of its two ends as seen. */
async function sides(page: Page, key: Key) {
  const s = await snap(page);
  const u = unit(s, key);
  expect(u.reach).toBeGreaterThan(12);
  const toward = (e: Key) => {
    const v = unit(s, e);
    const d = Math.hypot(v.sx - u.sx, v.sy - u.sy);
    const r = 0.4 * u.reach;
    return pixel(page, u.sx + (r * (v.sx - u.sx)) / d, u.sy + (r * (v.sy - u.sy)) / d);
  };
  return { u, drawn: [await toward(u.ends![0]), await toward(u.ends![1])] };
}

/** Each unit type's colour, by type id. */
async function typeColours(page: Page): Promise<Map<string, string>> {
  const list = await page.evaluate(() =>
    (window as any).graphview.model.types.unit.map((t: { id: string; colour: string }) => [t.id, t.colour]),
  );
  return new Map(list);
}

test('§8.10 Examples: the interface examples load, with the kind of every unit', async ({ page }) => {
  await open(page);
  for (const [id, interfaces, headline] of [
    ['interfaces-full', 3, 'Fully interfaced graph, 6 units, 6 relations, no issues'],
    ['interfaces-partial', 1, 'Partly interfaced graph, 4 units, 4 relations, no issues'],
    ['broken-interfaces', 4, 'Broken interfaces, 8 units, 7 relations, 3 issues'],
  ] as const) {
    await page.evaluate((i) => (window as any).graphview.loadExample(i), id);
    await settled(page);
    const s = await snap(page);
    expect(
      s.units.filter((u) => u.kind === 'interface'),
      id,
    ).toHaveLength(interfaces);
    expect(s.units.filter((u) => u.kind === 'plain').every((u) => u.ends === null)).toBe(true);
    await expect(page.getByTestId('headline')).toHaveText(headline);
  }
});

test('§6.17 Interfaces in the picture: in 2D each half shows the colour of the end on its side', async ({ page }) => {
  await open(page, 'interfaces-full');
  const colours = await typeColours(page);
  const s = await snap(page);
  for (const [key, ends] of [
    [10, [1, 2]],
    [11, [2, 3]],
  ] as const) {
    const u = unit(s, key);
    expect(u.ends).toEqual(ends);
    expect(u.halves).toEqual(ends.map((e) => colours.get(unit(s, e).type!)));
    await zoomOn(page, key, 220);
    const { drawn } = await sides(page, key);
    expect(close(drawn[0], rgb(u.halves[0])), `${key} toward ${ends[0]}: ${drawn[0]}`).toBe(true);
    expect(close(drawn[1], rgb(u.halves[1])), `${key} toward ${ends[1]}: ${drawn[1]}`).toBe(true);
  }
});

test('§6.17 Interfaces in the picture: in 3D, with a root and a turned camera, the halves still face their ends', async ({
  page,
}) => {
  await open(page, 'interfaces-full', { motion: 'off', theme: 'dark' });
  await call(page, 'setMode', '3d');
  await call(page, 'setRoot', 1);
  await zoomOn(page, 12, 300, true);
  const { u, drawn } = await sides(page, 12);
  expect(u.ends).toEqual([1, 3]);
  expect(close(drawn[0], rgb(u.halves[0])), `toward 1: ${drawn[0]}`).toBe(true);
  expect(close(drawn[1], rgb(u.halves[1])), `toward 3: ${drawn[1]}`).toBe(true);
});

test('§6.17 Interfaces in the picture: one end shows on both halves; a broken interface, and an end that is one, show the context colour', async ({
  page,
}) => {
  await open(page, 'broken-interfaces');
  const colours = await typeColours(page);
  const context = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--gv-context').trim().toUpperCase(),
  );
  const s = await snap(page);
  const d = colours.get(unit(s, 4).type!)!;
  expect(unit(s, 10).halves).toEqual([context, context]);
  expect(unit(s, 11).halves).toEqual([d, d]);
  expect(unit(s, 12).halves).toEqual([colours.get(unit(s, 1).type!), context]);
  expect(unit(s, 13).halves).toEqual([context, d]);
});

test('§7.4 Inspector: an interface shows the units it joins, then its keypairs each way through it', async ({
  page,
}) => {
  await open(page, 'interfaces-full');
  await call(page, 'inspect', { kind: 'unit', key: 10 });
  const inspector = page.getByTestId('inspector');
  await expect(inspector.locator('h3')).toHaveText('Interface between A and B');
  await expect(inspector.locator('[data-col="0"] h4')).toHaveText(['A to i', 'i to B']);
  await expect(inspector.locator('[data-col="1"] h4')).toHaveText(['B to i', 'i to A']);
  await expect(page.getByTestId('live')).toHaveText('Inspecting interface i');
  await call(page, 'inspect', { kind: 'unit', key: 1 });
  await expect(inspector.locator('h3')).toHaveCount(0);
  await expect(inspector.locator('[data-kind="unit"]')).toBeVisible();
});

test('§7.8 Data issues: the broken interfaces example lists each interface issue in words', async ({ page }) => {
  await open(page, 'broken-interfaces');
  await expect(page.getByTestId('rules-banner')).toBeVisible();
  await expect(page.getByTestId('section-issues').locator('li')).toHaveText([
    'The interface i joins 3 units, not 2.',
    'The interface j joins 1 unit, not 2.',
    'The interfaces k and l are related directly; an interface joins two plain units.',
  ]);
});

test('§8.16 Relations through interfaces: the Generate setting puts the share through interfaces, and the link keeps it', async ({
  page,
  context,
}) => {
  await open(page);
  await page.getByTestId('graph-choice').selectOption('family:cycle');
  await page.getByTestId('interfaces').fill('1');
  await expect(page.getByTestId('explanation')).toContainText('Relations through interfaces');
  await page.getByTestId('generate').click();
  await page.waitForFunction(() => (window as any).graphview.model.kinds.of.includes('interface'));
  await settled(page);
  const s = await snap(page);
  const plain = s.units.filter((u) => u.kind === 'plain').length;
  expect(s.units.filter((u) => u.kind === 'interface')).toHaveLength(plain);
  expect(s.units.filter((u) => u.kind === 'interface').every((u) => u.ends?.length === 2)).toBe(true);
  await expect(page.getByTestId('headline')).toContainText(`${2 * plain} units, ${2 * plain} relations, no issues`);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(JSON.parse(new URL(link).searchParams.get('gen')!).interfaces).toBe(1);
  const again = await context.newPage();
  await again.goto(link);
  await again.waitForFunction(() => (window as any).graphview?.ready() > 0, null, { timeout: 30000 });
  await settled(again);
  expect((await snap(again)).units.filter((u) => u.kind === 'interface')).toHaveLength(plain);
  await expect(again.getByTestId('interfaces')).toHaveValue('1');
});
