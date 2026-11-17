// Moving through the picture (specification 6.1, 6.3, 6.10, 6.11 and 6.14): the camera eases to where
// Fit and the keys send it, the wheel zooms toward the pointer, Glide comes to rest by itself, the
// pointer names what it rests on, and a layout that takes long says so and gives way to a newer graph.
import { expect, test, type Page } from '@playwright/test';
import { call, chevron, frames, longestLine, open, settled, snap, unit } from './helpers.ts';

type Camera = { position: number[]; target: number[] };
const camera = (page: Page) => page.evaluate(() => (window as any).graphview.canvas().getCamera()) as Promise<Camera>;
const moving = async (page: Page) =>
  !(await page.evaluate(() => (window as any).graphview.canvas().getScene().settled as boolean));
const distance = (c: Camera) => Math.hypot(...c.position.map((p, i) => p - c.target[i]));
/** Waits until the camera stands still. */
async function rest(page: Page): Promise<Camera> {
  let last = await camera(page);
  for (;;) {
    await page.waitForTimeout(150);
    const now = await camera(page);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
}

test('§6.10 and §6.14 Transitions: Fit and the keys move the camera over the transition; keys pressed in a row add up; with motion off they jump', async ({
  page,
}) => {
  await open(page, undefined, { motion: 'on' });
  await page.getByTestId('canvas').focus();
  const start = await camera(page);
  // An arrow pans a tenth of the view's height; two in a row end two steps away.
  const step = 2 * 0.1 * distance(start) * Math.tan((22.5 * Math.PI) / 180);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await moving(page)).toBe(true);
  await settled(page);
  const panned = await camera(page);
  expect(panned.target[0] - start.target[0]).toBeCloseTo(2 * step, 3);
  expect(panned.position[2]).toBeCloseTo(start.position[2], 6);
  // Two zooms in a row: 1.25 times closer, twice.
  await page.keyboard.press('=');
  await page.keyboard.press('=');
  await settled(page);
  expect(distance(await camera(page))).toBeCloseTo(distance(start) / 1.25 / 1.25, 3);
  // Fit moves back over the transition: on its way first, then where the graph shows whole.
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  expect(await moving(page)).toBe(true);
  const onTheWay = await camera(page);
  expect(distance(onTheWay)).toBeLessThan(distance(start));
  await settled(page);
  const fitted = await camera(page);
  expect(fitted.target).toEqual([0, 0, 0]);
  expect(distance(fitted)).toBeCloseTo(distance(start), 6);
  // With motion off, a key lands at once.
  await page.evaluate(() => (window as any).graphview.setLook({ motion: 'off' }));
  await frames(page);
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('ArrowLeft');
  expect(await moving(page)).toBe(false);
  expect((await camera(page)).target[0]).toBeCloseTo(-step, 3);
});

test('§6.3 2D and 3D: the wheel zooms toward the pointer, so that what lies under it stays there; with the setting off it zooms toward the centre', async ({
  page,
}) => {
  await open(page);
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const start = await camera(page);
  const before = unit(await snap(page), 3);
  await page.mouse.move(box.x + before.sx, box.y + before.sy);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
  await frames(page);
  const zoomed = await camera(page);
  const after = unit(await snap(page), 3);
  expect(Math.hypot(after.sx - before.sx, after.sy - before.sy)).toBeLessThan(1.5);
  // The camera came closer, and still looks straight down on the plane of the graph, which its target lies on.
  expect(distance(zoomed)).toBeLessThan(distance(start) * 0.8);
  expect(zoomed.target[2]).toBeCloseTo(0, 6);
  expect(zoomed.position[0]).toBeCloseTo(zoomed.target[0], 6);
  expect(zoomed.position[1]).toBeCloseTo(zoomed.target[1], 6);
  // Zooming out keeps it there, too.
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 120);
  await frames(page);
  const back = unit(await snap(page), 3);
  expect(Math.hypot(back.sx - before.sx, back.sy - before.sy)).toBeLessThan(1.5);
  // Toward the centre: the unit under the pointer moves away from it.
  await call(page, 'setSetting', 'camera.zoomToCursor', false);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await settled(page);
  await page.mouse.move(box.x + before.sx, box.y + before.sy);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
  await frames(page);
  const centred = unit(await snap(page), 3);
  expect(Math.hypot(centred.sx - before.sx, centred.sy - before.sy)).toBeGreaterThan(20);
  expect((await camera(page)).target).toEqual([0, 0, 0]);
});

test('§6.3 2D and 3D: with Glide on, a drag moves the view as far as without it, and the view comes to rest by itself', async ({
  page,
}) => {
  await open(page);
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  /** Drags 200 pixels to the right over empty canvas and returns how far the view's centre moved once it rests. */
  const drag = async () => {
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await settled(page);
    await page.mouse.move(x, y - 250);
    await page.mouse.down();
    await page.mouse.move(x + 200, y - 250, { steps: 10 });
    await page.mouse.up();
    return -(await rest(page)).target[0];
  };
  const plain = await drag();
  expect(plain).toBeGreaterThan(100);
  await call(page, 'setSetting', 'camera.damping', true);
  const glided = await drag();
  expect(Math.abs(glided - plain)).toBeLessThan(plain * 0.02);
});

test('§6.11 Picking: the pointer names what it rests on: a unit with its type, a chevron as its keypair, a line as its relation; the setting turns it off', async ({
  page,
}) => {
  await open(page);
  const s = await snap(page);
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const at = (p: { sx: number; sy: number }) => page.mouse.move(box.x + p.sx, box.y + p.sy);
  const label = page.getByTestId('hover-label');
  await expect(label).toHaveCount(0);
  const u = unit(s, 3);
  await at(u);
  await expect(label.locator('strong')).toHaveText('unit_3');
  await expect(label.locator('span')).toHaveText(u.type!);
  await expect(label).toHaveAttribute('aria-hidden', 'true');
  const { line } = longestLine(s);
  const c = chevron(s, line.a, line.b);
  await at(c);
  await expect(label.locator('strong')).toHaveText(`Keypair from unit_${line.a} to unit_${line.b}`);
  await expect(label.locator('span')).toHaveText(c.type!);
  await at(line);
  await expect(label).toHaveText(`Relation between unit_${line.a} and unit_${line.b}`);
  // Empty canvas has no name; neither has what the pointer left.
  await page.mouse.move(box.x + 3, box.y + 3);
  await expect(label).toHaveCount(0);
  // A click hides the label; it made the unit the root, as before.
  await at(u);
  await expect(label).toBeVisible();
  await page.mouse.down();
  await page.mouse.up();
  await expect(label).toHaveCount(0);
  await expect.poll(async () => (await snap(page)).root).toBe(3);
  // Off by its setting.
  await call(page, 'setSetting', 'pointer.hoverLabel', false);
  await page.mouse.move(box.x + 3, box.y + 3);
  await at(unit(await snap(page), 3));
  await page.waitForTimeout(300);
  await expect(label).toHaveCount(0);
});

test('§6.1 Layout: a layout that takes long says so over the canvas; a newer graph does not wait behind it', async ({
  page,
}) => {
  test.setTimeout(120000);
  await open(page);
  const note = page.getByTestId('laying-out');
  await expect(note).toHaveCount(0);
  // Two thousand units by preferential growth: the force layout takes many seconds.
  const large = page.evaluate(() => (window as any).graphview.generate('preferential', { n: 2000, m0: 2 }, 1));
  await expect(note).toHaveText('Laying out 2,000 units…', { timeout: 30000 });
  await expect(note).toHaveAttribute('role', 'status');
  const t0 = Date.now();
  await page.evaluate(() => (window as any).graphview.loadExample('petersen'));
  await settled(page);
  expect(Date.now() - t0).toBeLessThan(4000);
  await large;
  await expect(note).toHaveCount(0);
  await expect(page.getByTestId('headline')).toHaveText('Petersen graph, 10 units, 15 relations, no issues');
  expect((await snap(page)).units).toHaveLength(10);
});
