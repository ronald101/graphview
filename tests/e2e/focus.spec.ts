// Focus and filter: choose what to look at (specification V12 to V17).
import { expect, test } from '@playwright/test';
import {
  canvasBox,
  clearEvents,
  click,
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

const id = (k: Key) => JSON.stringify(k);

test.describe('focus and filter', () => {
  test('V12 hover: the hovered unit and its neighbours light up, the rest dims', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    await command(page, 'flyTo', 10);
    await frames(page);
    const s0 = await scene(page);
    const u = unit(s0, 10);
    const b = await canvasBox(page);
    await page.mouse.move(b.x + u.x, b.y + u.y);
    await frames(page);
    const s = await scene(page);
    const doc = graphFile('database-2026-07-24');
    const near = new Set([id(10)]);
    for (const e of doc.edges) {
      if (e.from === 10) near.add(id(e.to));
      if (e.to === 10) near.add(id(e.from));
    }
    expect(unit(s, 10).state.hovered).toBe(true);
    for (const x of s.units) expect(x.state.dimmed, `unit ${x.key}`).toBe(!near.has(id(x.key)));
    const ev = (await events(page, 'hover')).at(-1)!.payload;
    expect(ev).toEqual({ unit: 10, keypair: null });
  });

  test('V12 hover: a hovered half lights its keypair and the other half of its relation', async ({ page }) => {
    await open(page, 'path-4');
    const s0 = await scene(page);
    const [a, c] = [unit(s0, 2), unit(s0, 3)];
    const b = await canvasBox(page);
    await page.mouse.move(b.x + a.x + 0.25 * (c.x - a.x), b.y + a.y + 0.25 * (c.y - a.y));
    await frames(page);
    const s = await scene(page);
    const lit = s.halves
      .filter((h) => h.hovered)
      .map((h) => `${h.from}-${h.to}`)
      .sort();
    expect(lit).toEqual(['2-3', '3-2']);
    for (const x of s.units) expect(x.state.dimmed, `unit ${x.key}`).toBe(![2, 3].includes(x.key as number));
    expect((await events(page, 'hover')).at(-1)!.payload).toEqual({ unit: null, keypair: [2, 3] });
  });

  test('V13 select: a click on a unit selects it, and the select event fires', async ({ page }) => {
    await open(page, 'triangle');
    await clearEvents(page);
    const u = unit(await scene(page), 2);
    await click(page, u.x, u.y);
    expect((await viewState(page)).selection).toEqual({ units: [2], keypairs: [] });
    expect((await events(page, 'select')).at(-1)!.payload).toEqual({ units: [2], keypairs: [] });
    expect(unit(await scene(page), 2).state.selected).toBe(true);
  });

  test('V13 select: Shift adds to the selection, and Escape clears it', async ({ page }) => {
    await open(page, 'triangle');
    const s = await scene(page);
    await click(page, unit(s, 1).x, unit(s, 1).y);
    await click(page, unit(s, 3).x, unit(s, 3).y, ['Shift']);
    expect((await viewState(page)).selection.units).toEqual([1, 3]);
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('Escape');
    expect((await viewState(page)).selection).toEqual({ units: [], keypairs: [] });
    expect((await events(page, 'select')).at(-1)!.payload).toEqual({ units: [], keypairs: [] });
  });

  test('V13 select: Tab steps through the keypairs, outgoing first, and Enter activates the current one', async ({
    page,
  }) => {
    await open(page, 'star-6');
    await setView(page, { selection: { units: [1], keypairs: [] } });
    await clearEvents(page);
    await page.getByTestId('canvas').focus();
    const doc = graphFile('star-6');
    const outgoing = doc.edges
      .filter((e: { from: Key }) => e.from === 1)
      .map((e: { from: Key; to: Key }) => [e.from, e.to]);
    const incoming = doc.edges
      .filter((e: { to: Key }) => e.to === 1)
      .map((e: { from: Key; to: Key }) => [e.from, e.to]);
    const order = [...outgoing, ...incoming];
    const seen: unknown[] = [];
    for (let i = 0; i < order.length; i++) {
      await page.keyboard.press('Tab');
      seen.push((await events(page, 'hover')).at(-1)!.payload.keypair);
    }
    expect(seen).toEqual(order);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    expect((await events(page, 'activate')).at(-1)!.payload).toEqual({ keypair: order[order.length - 2] });
  });

  test('V13 select: a double click on a unit activates it', async ({ page }) => {
    await open(page, 'triangle');
    await clearEvents(page);
    const u = unit(await scene(page), 3);
    const b = await canvasBox(page);
    await page.mouse.dblclick(b.x + u.x, b.y + u.y);
    expect((await events(page, 'activate')).at(-1)!.payload).toEqual({ unit: 3 });
  });

  test('V13 select: a click on a short line selects the whole relation', async ({ page }) => {
    await open(page, 'path-4');
    await setView(page, { camera: { ...(await viewState(page)).camera, zoom: 0.25 } });
    const s = await scene(page);
    const [a, c] = [unit(s, 1), unit(s, 2)];
    const half = Math.hypot(c.x - a.x, c.y - a.y) / 2 - 6;
    expect(half).toBeLessThan(24);
    await click(page, (a.x + c.x) / 2, (a.y + c.y) / 2);
    const sel = (await viewState(page)).selection.keypairs.map(([x, y]) => `${x}-${y}`).sort();
    expect(sel).toEqual(['1-2', '2-1']);
  });

  test('V14 focus and radius: database graph, focus 1, radius 1, beyond hidden: exactly 6 units are visible', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await clearEvents(page);
    await setView(page, { focus: 1, radius: 1, beyond: 'hide' });
    const s = await scene(page);
    expect(s.units.filter((u) => u.visible).length).toBe(6);
    expect((await events(page, 'focus')).at(-1)!.payload).toEqual({ focus: 1, radius: 1 });
  });

  test('V14 focus and radius: F sets the focus, Shift with plus and minus sets the radius, beyond fades', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { selection: { units: [1], keypairs: [] } });
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('f');
    expect((await viewState(page)).focus).toBe(1);
    await page.keyboard.press('Shift+Equal');
    await page.keyboard.press('Shift+Equal');
    expect((await viewState(page)).radius).toBe(2);
    await page.keyboard.press('Shift+Minus');
    expect((await viewState(page)).radius).toBe(1);
    const s = await scene(page);
    const exp = expected('database-2026-07-24').rings.find((r: { focus: Key }) => r.focus === 1).rings;
    const near = new Set([...exp[0], ...exp[1]].map(id));
    for (const u of s.units) {
      expect(u.visible).toBe(true);
      expect(u.state.faded, `unit ${u.key}`).toBe(!near.has(id(u.key)));
    }
  });

  test('V14 focus and radius: Focus here in the details panel sets the focus', async ({ page }) => {
    await open(page, 'petersen');
    await setView(page, { selection: { units: [4], keypairs: [] } });
    await page.getByRole('button', { name: 'Focus here' }).click();
    expect((await viewState(page)).focus).toBe(4);
    expect(unit(await scene(page), 4).state.focus).toBe(true);
  });

  test('V15 search: typing viewtest_n offers VIEWTEST_NOTE, and Enter selects unit 79 and centres it', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('/');
    const box = page.getByRole('searchbox', { name: 'Find a unit' });
    await expect(box).toBeFocused();
    await box.fill('viewtest_n');
    const options = page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option');
    await expect(options.first()).toContainText('VIEWTEST_NOTE');
    expect(await options.count()).toBeLessThanOrEqual(10);
    await box.press('Enter');
    await frames(page);
    expect((await viewState(page)).selection.units).toEqual([79]);
    const s = await scene(page);
    expectNear(unit(s, 79).x, s.width / 2, 2, 'x');
    expectNear(unit(s, 79).y, s.height / 2, 2, 'y');
  });

  test('V16 hide lone units: in broken-orphan, unit 3 disappears', async ({ page }) => {
    await open(page, 'broken-orphan');
    expect(unit(await scene(page), 3).visible).toBe(true);
    await setView(page, { filters: { hideLoneUnits: true } });
    const s = await scene(page);
    expect(unit(s, 3).visible).toBe(false);
    expect(s.units.filter((u) => u.visible).length).toBe(2);
  });

  test('V16 hide lone units: in two-pairs, no unit disappears', async ({ page }) => {
    await open(page, 'two-pairs');
    await setView(page, { filters: { hideLoneUnits: true } });
    const s = await scene(page);
    expect(s.units.every((u) => u.visible)).toBe(true);
  });

  test('V16 hide lone units: units left alone by the radius disappear too', async ({ page }) => {
    await open(page, 'path-4');
    await setView(page, { focus: 1, radius: 0, beyond: 'hide', filters: { hideLoneUnits: true } });
    expect((await scene(page)).units.filter((u) => u.visible).length).toBe(0);
  });

  // Every path entry of the small fixtures and the database graph.
  const names = [
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
  ];
  for (const name of names) {
    for (const e of expected(name).paths ?? []) {
      test(`V17 path explorer: ${name}, ${id(e.from)} to ${id(e.to)}, ${e.extra} extra, limit ${e.countLimit}, ${e.graph} graph`, async ({
        page,
      }) => {
        await open(page, name, {
          motion: 'off',
          superseded: e.graph === 'current' ? 'hide' : 'fade',
          limits: { pathCount: e.countLimit, pathList: e.listLimit, pathTimeMs: 60000, maxExtra: 20 },
        });
        await clearEvents(page);
        const result = await command<{
          lengths: { length: number; count: number; exact: boolean }[];
          total: number;
          stopped: boolean;
        }>(page, 'showPaths', e.from, e.to, e.extra);
        await frames(page);
        const panel = page.getByTestId('paths-panel');
        if (e.reason === 'unreachable') {
          await expect(panel).toContainText('No path leads');
        } else {
          for (const l of e.lengths) {
            const row = panel.locator(`[data-length="${l.length}"]`);
            await expect(row).toHaveAttribute('data-count', String(l.count));
            await expect(row).toHaveAttribute('data-exact', String(l.exact));
          }
          expect(await panel.locator('[data-length]').count()).toBe(e.lengths.length);
          if (e.stopped)
            await expect(panel).toContainText(
              `at least ${e.lengths.at(-1).count.toLocaleString('en')}: counting stopped`,
            );
        }
        const ev = (await events(page, 'pathset')).at(-1)!.payload;
        expect(ev.total).toBe(e.total ?? 0);
        expect(ev.stopped).toBe(e.stopped);
        expect(
          ev.lengths.map((l: { length: number; count: number; exact: boolean }) => [l.length, l.count, l.exact]),
        ).toEqual(
          e.lengths.map((l: { length: number; count: number; exact: boolean }) => [l.length, l.count, l.exact]),
        );
        expect(result.total).toBe(ev.total);
      });
    }
  }

  test('V17 path explorer: two selected units open it; hovering lights a path; a click keeps it lit; arrows step', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { selection: { units: [79, 77], keypairs: [] } });
    await command(page, 'fit', 'selection');
    await setView(page, { selection: { units: [], keypairs: [] } });
    const s0 = await scene(page);
    await click(page, unit(s0, 79).x, unit(s0, 79).y);
    await click(page, unit(s0, 77).x, unit(s0, 77).y, ['Shift']);
    expect((await viewState(page)).selection.units).toEqual([79, 77]);
    await page.waitForTimeout(300);
    const panel = page.getByTestId('paths-panel');
    await expect(panel.locator('[data-length="3"]')).toHaveAttribute('data-count', '1');
    await command(page, 'showPaths', 79, 77, 4);
    await frames(page);
    const first = panel.locator('button[data-path]').first();
    await first.hover();
    await frames(page);
    let s = await scene(page);
    expect(s.halves.filter((h) => h.role === 'path').length).toBe(3);
    await first.click();
    expect((await viewState(page)).paths.lit).toEqual({ length: 3, index: 0 });
    await first.press('ArrowDown');
    expect((await viewState(page)).paths.lit).toEqual({ length: 4, index: 0 });
    await panel.locator('[data-length="6"] button', { hasText: 'Show all' }).click();
    await frames(page);
    s = await scene(page);
    const widths = s.halves.filter((h) => h.role === 'path').map((h) => h.width);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...widths)).toBeLessThanOrEqual(6);
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths));
  });

  test('V17 path explorer: plus and minus change the extra steps while the panel has focus', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    await command(page, 'showPaths', 79, 77, 2);
    const panel = page.getByTestId('paths-panel');
    await panel.getByRole('slider', { name: 'Extra steps' }).focus();
    await page.keyboard.press('+');
    await page.waitForTimeout(300);
    expect((await viewState(page)).paths.extra).toBe(3);
    await page.keyboard.press('-');
    await page.waitForTimeout(300);
    expect((await viewState(page)).paths.extra).toBe(2);
    await setLook(page, { motion: 'off' });
  });
});
