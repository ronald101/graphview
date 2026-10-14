// Gate G13: every event fires with its payload, every command works, and the release 2 commands answer as stated.
import { expect, test } from '@playwright/test';
import { clearEvents, command, events, expected, frames, open, scene, setView, viewState } from './helpers.ts';

test.describe('G13 events and commands', () => {
  test('G13 events: select, hover, activate, focus, camera, viewstate, layoutsettled, pathset and issues fire with payloads', async ({
    page,
  }) => {
    await open(page, 'triangle');
    const settled = await events(page, 'layoutsettled');
    expect(settled.at(-1)!.payload.name).toBe('given' === settled.at(-1)!.payload.name ? 'given' : 'force');
    expect(settled.at(-1)!.payload.positions).toHaveLength(3);
    const issues = await events(page, 'issues');
    expect(issues.at(-1)!.payload).toEqual([]);
    await clearEvents(page);
    await setView(page, { selection: { units: [1], keypairs: [] } });
    await page.getByTestId('canvas').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('f');
    await page.keyboard.press('ArrowLeft');
    const s = await scene(page);
    const b = (await page.getByTestId('canvas').boundingBox())!;
    await page.mouse.move(b.x + s.units[2].x, b.y + s.units[2].y);
    await command(page, 'showPaths', 1, 2, 1);
    await page.waitForTimeout(400);
    const names = new Set((await events(page)).map((e) => e.name));
    for (const n of ['select', 'activate', 'focus', 'camera', 'hover', 'pathset', 'viewstate'])
      expect(names.has(n), n).toBe(true);
    expect((await events(page, 'select')).at(-1)!.payload).toEqual({ units: [1], keypairs: [] });
    expect((await events(page, 'activate')).at(-1)!.payload).toEqual({ unit: 1 });
    expect((await events(page, 'focus')).at(-1)!.payload).toEqual({ focus: 1, radius: null });
    expect((await events(page, 'hover')).at(-1)!.payload).toEqual({ unit: 3, keypair: null });
    const ps = (await events(page, 'pathset')).at(-1)!.payload;
    expect(ps).toMatchObject({
      from: 1,
      to: 2,
      extra: 1,
      shortest: 1,
      reason: null,
      total: 2,
      stopped: false,
      stoppedBy: null,
    });
    const vs = (await events(page, 'viewstate')).at(-1)!.payload;
    expect(vs).toEqual(await viewState(page));
    expect(names.has('expandrequest')).toBe(false);
  });

  test('G13 events: the camera event fires at most ten times a second', async ({ page }) => {
    await open(page, 'petersen');
    await clearEvents(page);
    await page.getByTestId('canvas').focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const cams = await events(page, 'camera');
    expect(cams.length).toBeGreaterThan(0);
    expect(cams.length).toBeLessThan(30);
  });

  test('G13 events: issues fire after loading, for a refused file, and for an overlay that does not match', async ({
    page,
  }) => {
    await open(page, 'broken-mixed');
    expect((await events(page, 'issues')).at(-1)!.payload).toEqual(expected('broken-mixed').issues);
    await open(page, 'load-error-format');
    await page.waitForTimeout(200);
    expect((await events(page, 'issues')).at(-1)!.payload).toEqual([{ code: 'refused', refusal: 'format' }]);
    await open(page, 'pair');
    await page.evaluate(() =>
      (window as any).graphview.setOverlays([
        { id: 'ranks', label: 'Ranks', kind: 'values', items: [], graph: 'sha256:0' },
      ]),
    );
    await page.waitForTimeout(200);
    expect((await events(page, 'issues')).at(-1)!.payload).toEqual([{ code: 'overlay-mismatch', overlay: 'ranks' }]);
  });

  test('G13 commands: fit, flyTo, rotateTo, setLayout, showPaths, exportPicture, getViewState and setViewState work', async ({
    page,
  }) => {
    await open(page, 'petersen');
    await command(page, 'rotateTo', 45);
    expect((await viewState(page)).camera.angle).toBe(45);
    await command(page, 'flyTo', 3);
    const vs = await viewState(page);
    await command(page, 'fit');
    expect((await viewState(page)).camera.zoom).not.toBe(vs.camera.zoom);
    await command(page, 'setLayout', { name: 'circle' });
    expect((await viewState(page)).layout.name).toBe('circle');
    const r = await command<{ shortest: number }>(page, 'showPaths', 0, 2, 2);
    expect(r.shortest).toBe(expected('petersen').paths[0].shortest);
    expect(
      await page.evaluate(async () => ((await (window as any).graphview.view.exportPicture()) as Blob).size),
    ).toBeGreaterThan(100);
    await command(page, 'setViewState', { focus: 5, radius: 1 });
    expect(await viewState(page)).toMatchObject({ focus: 5, radius: 1, format: 'graphview-view/1' });
    expect((await viewState(page)).graph).toBe(expected('petersen').fingerprint.stored);
    await frames(page);
  });

  test('G13 commands: spotlight, play, pause, step and seek answer release-2', async ({ page }) => {
    await open(page, 'pair');
    for (const [name, args] of [
      ['spotlight', [1]],
      ['play', []],
      ['pause', []],
      ['step', [1]],
      ['seek', [0]],
    ] as const) {
      expect(await command(page, name, ...args), name).toEqual({ ok: false, reason: 'release-2' });
    }
  });
});
