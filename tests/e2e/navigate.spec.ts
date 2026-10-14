// Navigate: move the camera, never the data (specification V01 to V05).
import { expect, test } from '@playwright/test';
import {
  canvasBox,
  command,
  events,
  clearEvents,
  expectNear,
  frames,
  open,
  scene,
  setView,
  unit,
  viewState,
} from './helpers.ts';

test.describe('navigate', () => {
  test('V01 pan: dragging 100 pixels to the right moves every unit 100 pixels to the right', async ({ page }) => {
    await open(page, 'petersen');
    const before = await scene(page);
    const b = await canvasBox(page);
    // Start on empty background: the canvas's top left area.
    const x0 = b.x + 40;
    const y0 = b.y + b.height - 40;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 50, y0, { steps: 5 });
    await page.mouse.move(x0 + 100, y0, { steps: 5 });
    await page.mouse.up();
    await frames(page);
    const after = await scene(page);
    for (const u of before.units) {
      const v = unit(after, u.key);
      expectNear(v.x - u.x, 100, 2, `unit ${u.key} x`);
      expectNear(v.y - u.y, 0, 2, `unit ${u.key} y`);
    }
  });

  test('V01 pan: an arrow key moves the camera, and the camera event fires', async ({ page }) => {
    await open(page, 'petersen');
    const before = (await viewState(page)).camera;
    await clearEvents(page);
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    const after = (await viewState(page)).camera;
    expect(after.x).not.toBeCloseTo(before.x, 5);
    const cam = await events(page, 'camera');
    expect(cam.length).toBeGreaterThan(0);
    expect(cam.at(-1)!.payload).toMatchObject({ x: after.x, y: after.y, zoom: after.zoom, angle: after.angle });
  });

  test('V02 zoom: the graph point under the pointer stays under it', async ({ page }) => {
    await open(page, 'petersen');
    const s = await scene(page);
    const u = s.units[3];
    const b = await canvasBox(page);
    await page.mouse.move(b.x + u.x, b.y + u.y);
    await page.mouse.wheel(0, -300);
    await frames(page);
    const after = unit(await scene(page), u.key);
    expectNear(after.x, u.x, 2, 'x');
    expectNear(after.y, u.y, 2, 'y');
    expect((await viewState(page)).camera.zoom).toBeGreaterThan(1.2);
  });

  test('V02 zoom: zoom stays between 0.25 and 40', async ({ page }) => {
    await open(page, 'petersen');
    await page.getByTestId('canvas').focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('=');
    expect((await viewState(page)).camera.zoom).toBeLessThanOrEqual(40);
    expectNear((await viewState(page)).camera.zoom, 40, 1e-6, 'upper limit');
    for (let i = 0; i < 40; i++) await page.keyboard.press('-');
    expectNear((await viewState(page)).camera.zoom, 0.25, 1e-6, 'lower limit');
    await setView(page, { camera: { ...(await viewState(page)).camera, zoom: 1000 } });
    expect((await viewState(page)).camera.zoom).toBeLessThanOrEqual(40);
  });

  test('V03 fit: after fitting, every visible unit lies inside the canvas with the margin', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { camera: { x: 0, y: 0, zoom: 7, angle: 30 } });
    await command(page, 'fit', 'all');
    await frames(page);
    const s = await scene(page);
    for (const u of s.units.filter((x) => x.visible)) {
      expect(u.x, `unit ${u.key}`).toBeGreaterThanOrEqual(24);
      expect(u.y, `unit ${u.key}`).toBeGreaterThanOrEqual(24);
      expect(u.x, `unit ${u.key}`).toBeLessThanOrEqual(s.width - 24);
      expect(u.y, `unit ${u.key}`).toBeLessThanOrEqual(s.height - 24);
    }
  });

  test('V03 fit: fitting the selection shows the selected units', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { selection: { units: [79, 77], keypairs: [] } });
    await command(page, 'fit', 'selection');
    await frames(page);
    const s = await scene(page);
    for (const k of [79, 77]) {
      const u = unit(s, k);
      expect(u.x).toBeGreaterThanOrEqual(24);
      expect(u.x).toBeLessThanOrEqual(s.width - 24);
    }
    expect((await viewState(page)).camera.zoom).toBeGreaterThan(1);
  });

  test('V04 rotate: a unit to the right of the centre appears below it, labels stay upright', async ({ page }) => {
    await open(page, 'path-4');
    await clearEvents(page);
    await command(page, 'rotateTo', 90);
    await frames(page);
    const s = await scene(page);
    // In path-4, unit 4 lies to the right of unit 1 at angle 0.
    const a = unit(s, 1);
    const b = unit(s, 4);
    expect(b.y - a.y).toBeGreaterThan(50);
    expectNear(b.x, a.x, 2, 'x');
    for (const u of s.units.filter((x) => x.label.visible)) expect(u.label.angle).toBe(0);
    await page.waitForTimeout(150);
    expect((await events(page, 'camera')).at(-1)!.payload.angle).toBe(90);
  });

  test('V04 rotate: brackets turn 15 degrees and 0 returns to north', async ({ page }) => {
    await open(page, 'path-4');
    await page.getByTestId('canvas').focus();
    await page.keyboard.press(']');
    expect((await viewState(page)).camera.angle).toBe(15);
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    expect((await viewState(page)).camera.angle).toBe(345);
    await page.keyboard.press('0');
    await frames(page);
    expect((await viewState(page)).camera.angle).toBe(0);
    await page.getByRole('button', { name: 'Rotate right' }).click();
    expect((await viewState(page)).camera.angle).toBe(15);
    await page.getByRole('button', { name: 'North' }).click();
    await frames(page);
    expect((await viewState(page)).camera.angle).toBe(0);
  });

  test('V05 fly to: the unit sits at the canvas centre and its label is visible', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    await command(page, 'flyTo', 42);
    await frames(page);
    const s = await scene(page);
    const u = unit(s, 42);
    expectNear(u.x, s.width / 2, 2, 'x');
    expectNear(u.y, s.height / 2, 2, 'y');
    expect(u.label.visible).toBe(true);
  });
});
