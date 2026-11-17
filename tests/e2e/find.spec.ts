// Finding and narrowing in the browser (specification 6.7, 6.19 to 6.21 and 7.11): the bar's search and
// the Search section, filter rules from the Types and Filters panels, the selection by Ctrl and a click or
// by a box, highlight groups with their dimming and direction colours, and the scope with S, A and +n.
import { expect, test, type Page } from '@playwright/test';
import { call, click, frames, open, read, settled, snap, unit, type Key } from './helpers.ts';

const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });

test('§6.19 and §7.11 Search: the bar searches as a person types; the Search section lists the results by rank; Enter shows the first', async ({
  page,
}) => {
  await open(page);
  const panel = page.getByTestId('search-panel');
  await expect(panel).toContainText('Type in the search field above the canvas.');
  await search(page).fill('unit_7');
  const rows = panel.locator('li');
  await expect(rows.first()).toContainText('unit_7');
  await expect(rows.first()).toContainText('matched in label');
  const results = await read<{ results: { key: Key; rank: number }[] }>(page, 'search');
  expect(results.results.map((r) => r.rank)).toEqual([...results.results.map((r) => r.rank)].sort((a, b) => a - b));
  await expect(rows).toHaveCount(results.results.length);
  await expect(page.getByTestId('live')).toHaveText(`${results.results.length} results for "unit_7"`);
  // Enter shows the first result's neighbourhood and inspects it.
  await search(page).press('Enter');
  await settled(page);
  expect(await read<{ centres: Key[] }>(page, 'scope')).toMatchObject({ centres: [7] });
  expect(await read(page, 'inspected')).toEqual({ kind: 'unit', key: 7 });
  // A result's buttons: Root, and Highlight, which adds it to the group Search results.
  await rows.first().getByRole('button', { name: 'Root' }).click();
  await expect.poll(async () => (await snap(page)).root).toBe(7);
  await rows.first().getByRole('button', { name: 'Highlight' }).click();
  await frames(page);
  expect(unit(await snap(page), 7).emphasis).toBe(1);
  await search(page).fill('nothing like this');
  await expect(panel).toContainText('No result for "nothing like this"');
  await expect(page.getByTestId('live')).toHaveText('No result for "nothing like this"');
});

test('§6.7 and §7.7 Filter rules: a type faded or hidden in the Types panel fades or hides its units and their keypairs; a faded unit answers no click', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('section-types').locator('h2 button').click();
  const before = await snap(page);
  const type = unit(before, 79).type!;
  const members = before.units.filter((u) => u.type === type).map((u) => u.key);
  await page.getByRole('combobox', { name: `Show the unit type ${type}` }).selectOption('hide');
  await settled(page);
  const hidden = await snap(page);
  for (const k of members) expect(unit(hidden, k).visible).toBe(false);
  expect(
    hidden.chevrons.filter((c) => members.includes(c.from) || members.includes(c.to)).every((c) => !c.visible),
  ).toBe(true);
  await page.getByRole('combobox', { name: `Show the unit type ${type}` }).selectOption('fade');
  await settled(page);
  const faded = await snap(page);
  expect(unit(faded, 79).opacity).toBeCloseTo(unit(before, 79).opacity * 0.15, 2);
  const u = unit(faded, 79);
  await click(page, u.sx, u.sy);
  expect(await read(page, 'root')).toBeNull();
  // The Filters panel clears the rules.
  await page.getByTestId('section-filters').locator('h2 button').click();
  await page.getByRole('button', { name: 'Clear rules' }).click();
  await settled(page);
  expect(unit(await snap(page), 79).opacity).toBeCloseTo(unit(before, 79).opacity, 2);
});

test('§6.20 Selection and highlights: Ctrl and a click toggle a unit; one selected unit colours its chevrons by direction while the rest dims; Escape clears it', async ({
  page,
}) => {
  await open(page);
  const s = await snap(page);
  const u = unit(s, 79);
  await page.keyboard.down('Control');
  await click(page, u.sx, u.sy);
  await page.keyboard.up('Control');
  expect(await read(page, 'selection')).toEqual([79]);
  expect(await read(page, 'root')).toBeNull();
  await frames(page);
  const lit = await snap(page);
  expect(unit(lit, 79)).toMatchObject({ selected: true, emphasis: 1 });
  expect(unit(lit, 79).scale).toBeCloseTo(unit(s, 79).scale * 1.15, 3);
  // Units outside the groups dim; the chevrons of 79 take the outgoing and incoming colours.
  const other = lit.units.find((x) => x.key !== 79)!;
  expect(other.opacity).toBeCloseTo(unit(s, other.key).opacity * 0.25, 2);
  const tokens = await page.evaluate(() => (window as any).graphview.model.colours());
  for (const c of lit.chevrons.filter((c) => c.from === 79)) expect(c.colour).toBe(tokens.outgoing);
  for (const c of lit.chevrons.filter((c) => c.to === 79)) expect(c.colour).toBe(tokens.incoming);
  expect(lit.labels.map((l) => l.key)).toContain(79);
  // The Highlights section counts the selection; Escape clears it once the root and target are clear.
  await page.getByTestId('section-highlights').locator('h2 button').click();
  await expect(page.locator('[data-group="Selection"] .gv-count')).toHaveText('1');
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Escape');
  expect(await read(page, 'selection')).toEqual([]);
  await frames(page);
  expect(unit(await snap(page), 79).emphasis).toBe(0);
});

test('§6.20 Selection: with Box selection on, a drag selects the units drawn inside the box; with Ctrl it takes them out', async ({
  page,
}) => {
  await open(page);
  const s = await snap(page);
  const b = (await page.getByTestId('canvas').boundingBox())!;
  const centre = { x: s.width / 2, y: s.height / 2 };
  const inside = s.units
    .filter((u) => u.visible && Math.abs(u.sx - centre.x) < 120 && Math.abs(u.sy - centre.y) < 120)
    .map((u) => u.key);
  expect(inside.length).toBeGreaterThan(0);
  const camera = await page.evaluate(() => (window as any).graphview.canvas().getCamera());
  await page.getByRole('checkbox', { name: 'Box selection' }).check();
  const drag = async () => {
    await page.mouse.move(b.x + centre.x - 120, b.y + centre.y - 120);
    await page.mouse.down();
    await page.mouse.move(b.x + centre.x + 120, b.y + centre.y + 120, { steps: 5 });
    await expect(page.getByTestId('selection-box')).toBeVisible();
    await page.mouse.up();
  };
  await drag();
  expect(new Set(await read<Key[]>(page, 'selection'))).toEqual(new Set(inside));
  // The camera held still while the box was drawn.
  expect(await page.evaluate(() => (window as any).graphview.canvas().getCamera())).toEqual(camera);
  await page.keyboard.down('Control');
  await drag();
  await page.keyboard.up('Control');
  expect(await read(page, 'selection')).toEqual([]);
});

test("§6.21 and §7.11 Scope: S shows the inspected unit's neighbourhood; outside units go; labels count the relations that leave it; Expand, Hide and A", async ({
  page,
}) => {
  await open(page);
  await call(page, 'inspect', { kind: 'unit', key: 7 });
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('s');
  await settled(page);
  const scope = await read<{ centres: Key[]; units: Key[] }>(page, 'scope');
  expect(scope.centres).toEqual([7]);
  const s = await snap(page);
  for (const u of s.units) expect(u.inScope).toBe(scope.units.includes(u.key));
  for (const u of s.units.filter((x) => !x.inScope)) expect(u.visible).toBe(false);
  const leaving = s.units.filter((u) => u.inScope && u.outside > 0);
  expect(leaving.length).toBeGreaterThan(0);
  for (const l of s.labels.filter((x) => leaving.some((u) => u.key === x.key)))
    expect(l.text).toMatch(new RegExp(` \\+${unit(s, l.key).outside}$`));
  await page.getByTestId('section-scope').locator('h2 button').click();
  await expect(page.getByTestId('scope-words')).toHaveText(
    `Neighbourhood of ${await page.evaluate(() => (window as any).graphview.model.label(7))}, ${scope.units.length} units`,
  );
  // Expand the selected unit at the edge, then hide it again.
  const edge = leaving.find((u) => u.key !== 7)!.key;
  await call(page, 'select', [edge], 'replace');
  await page.getByRole('button', { name: 'Expand selected' }).click();
  await settled(page);
  const grown = await read<{ units: Key[] }>(page, 'scope');
  expect(grown.units.length).toBeGreaterThan(scope.units.length);
  await page.getByRole('button', { name: 'Hide selected' }).click();
  await settled(page);
  expect((await read<{ units: Key[] }>(page, 'scope')).units).not.toContain(edge);
  // A shows every unit again.
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('a');
  await settled(page);
  expect(await read(page, 'scope')).toBeNull();
  expect((await snap(page)).units.every((u) => u.inScope && u.visible)).toBe(true);
  // The inspector shows the inspected unit's neighbourhood too.
  await call(page, 'inspect', { kind: 'unit', key: 79 });
  await page.getByTestId('inspector').getByRole('button', { name: 'Show neighbourhood' }).click();
  await settled(page);
  expect(await read<{ centres: Key[] }>(page, 'scope')).toMatchObject({ centres: [79] });
});
