// Encode and explain: show what things mean (specification V18 to V23).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  canvasBox,
  expected,
  frames,
  index,
  open,
  scene,
  setLook,
  setView,
  unit,
  viewState,
  type Key,
} from './helpers.ts';
import { tokens } from '../../module/core/tokens.ts';

test.describe('encode and explain', () => {
  test('V18 relations in two halves: around a selected unit, outgoing halves take the first hue and incoming the second', async ({
    page,
  }) => {
    await open(page, 'star-6');
    await setView(page, { selection: { units: [1], keypairs: [] } });
    const s = await scene(page);
    expect(s.halves.length).toBe(10);
    for (const h of s.halves) {
      const want = h.from === 1 ? 'outgoing' : h.to === 1 ? 'incoming' : 'context';
      expect(h.role, `${h.from} to ${h.to}`).toBe(want);
      expect(h.style).toBe('solid');
    }
    await setView(page, { selection: { units: [], keypairs: [] } });
    expect((await scene(page)).halves.every((h) => h.role === 'context')).toBe(true);
  });

  test('V18 relations in two halves: each half runs from its own unit to the middle, chevrons by length', async ({
    page,
  }) => {
    await open(page, 'path-4');
    const s = await scene(page);
    for (const h of s.halves) {
      const a = unit(s, h.from);
      const b = unit(s, h.to);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      expect(Math.hypot(h.end.x - mid.x, h.end.y - mid.y)).toBeLessThan(0.01);
      expect(Math.hypot(h.start.x - a.x, h.start.y - a.y)).toBeCloseTo(6, 3);
      const length = Math.hypot(h.end.x - h.start.x, h.end.y - h.start.y);
      expect(h.icon, `${h.from} to ${h.to}`).toBe(length >= 40);
      expect(h.width).toBe(1.5);
    }
    await setView(page, { camera: { ...(await viewState(page)).camera, zoom: 0.25 } });
    expect((await scene(page)).halves.some((h) => h.icon)).toBe(false);
    await setView(page, { selection: { units: [2], keypairs: [] } });
    const around = (await scene(page)).halves.filter((h) => h.from === 2 || h.to === 2);
    expect(around.every((h) => h.icon)).toBe(true);
  });

  test('V18 relations in two halves: broken-missing-reverse shows exactly one missing, dashed half', async ({
    page,
  }) => {
    await open(page, 'broken-missing-reverse');
    const s = await scene(page);
    const missing = s.halves.filter((h) => h.missing);
    expect(missing.length).toBe(1);
    expect(missing[0].style).toBe('dashed');
    expect(missing[0].role).toBe('issue');
    const issue = expected('broken-missing-reverse').issues.find((i: { code: string }) => i.code === 'missing-reverse');
    expect([missing[0].to, missing[0].from]).toEqual(issue.keypair);
  });

  test('V18 relations in two halves: a selected keypair widens to 3 pixels, and the key panel explains the colours', async ({
    page,
  }) => {
    await open(page, 'triangle');
    await setView(page, { selection: { units: [1], keypairs: [] } });
    const key = page.getByTestId('key-panel');
    await expect(key).toContainText('Outgoing keypairs of the selection');
    await expect(key).toContainText('Incoming keypairs of the selection');
    await setView(page, { selection: { units: [], keypairs: [[1, 2]] } });
    const h = (await scene(page)).halves.find((x) => x.from === 1 && x.to === 2)!;
    expect(h.selected).toBe(true);
    expect(h.width).toBe(3);
  });

  test('V18 relations in two halves: the other drawings, arrows and lines, are available', async ({ page }) => {
    await open(page, 'triangle');
    for (const draw of ['arrows', 'lines', 'halves']) {
      await setLook(page, { motion: 'off', relations: { draw } });
      const s = await scene(page);
      expect(s.halves.length).toBe(6);
      expect(s.halves.some((h) => h.icon)).toBe(draw === 'halves');
    }
  });

  test('V18 relations in two halves: colour by keypair attribute takes the three most frequent values', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24', { motion: 'off', relations: { colour: { attr: 'type' } } });
    const s = await scene(page);
    const roles = new Set(s.halves.map((h) => h.role));
    const attrRoles = [...roles].filter((r) => r.startsWith('attr:'));
    expect(attrRoles.length).toBe(3);
    await expect(page.getByTestId('key-panel')).toContainText('type: any other value');
  });

  test('V19 labels: at three zoom levels, no two visible label boxes come closer than 2 pixels', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    for (const zoom of [1, 2.5, 5]) {
      await setView(page, { camera: { ...(await viewState(page)).camera, zoom } });
      const boxes = (await scene(page)).units.filter((u) => u.label.visible).map((u) => u.label.box!);
      expect(boxes.length, `zoom ${zoom}`).toBeGreaterThan(1);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
          const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
          expect(Math.max(gapX, gapY), `zoom ${zoom}: boxes ${i} and ${j}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  test('V19 labels: the selection, the focus and the hovered unit always show their labels', async ({ page }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { selection: { units: [3, 44, 61], keypairs: [] }, focus: 12 });
    const s = await scene(page);
    for (const k of [3, 44, 61, 12]) expect(unit(s, k).label.visible, `unit ${k}`).toBe(true);
  });

  test('V20 details: the keypair from 76 to 80 shows "about" and 1 against "has_engagement" and 0.1, marked as differing', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { selection: { units: [], keypairs: [[76, 80]] } });
    const d = page.getByTestId('keypair-details');
    const first = d.locator('[data-col="0"]');
    const second = d.locator('[data-col="1"]');
    await expect(first.locator('[data-field="type"]')).toContainText('about');
    await expect(first.locator('[data-field="weight"]')).toContainText('1');
    await expect(second.locator('[data-field="type"]')).toContainText('has_engagement');
    await expect(second.locator('[data-field="weight"]')).toContainText('0.1');
    for (const col of [first, second]) {
      for (const f of ['type', 'weight'])
        await expect(col.locator(`[data-field="${f}"]`)).toHaveAttribute('data-differs', 'true');
    }
    await second.getByRole('button', { name: 'Its reverse' }).click();
    expect((await viewState(page)).selection.keypairs).toEqual([[80, 76]]);
  });

  test('V20 details: a selected unit shows its key, label, relations, keypairs, ring and attributes', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, { focus: 1, selection: { units: [79], keypairs: [] } });
    const d = page.getByTestId('unit-details');
    await expect(d).toContainText('79');
    await expect(d).toContainText('VIEWTEST_NOTE');
    await expect(d).toContainText('Ring');
    await expect(page.getByRole('heading', { name: 'Outgoing keypairs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attributes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Paths from here' })).toBeVisible();
  });

  for (const f of index()) {
    test(`V21 data issues: ${f.fixture} lists exactly the expected issues, in order`, async ({ page }) => {
      test.setTimeout(180000);
      await open(page, f.fixture);
      const exp = expected(f.fixture);
      const panel = page.getByTestId('issues-panel');
      if (exp.load === 'refused') {
        await expect(panel.locator('[data-code]')).toHaveAttribute('data-code', exp.code);
        await expect(page.getByTestId('refused')).toHaveAttribute('data-code', exp.code);
        return;
      }
      const codes = await panel
        .locator('li[data-code]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-code')));
      expect(codes).toEqual(exp.issues.map((i: { code: string }) => i.code));
      if (!exp.issues.length) await expect(panel).toContainText('No issues.');
    });
  }

  test('V21 data issues: a click on an issue that has something drawn flies to it', async ({ page }) => {
    await open(page, 'broken-mixed');
    await setView(page, { camera: { ...(await viewState(page)).camera, x: 1000, y: 1000 } });
    await page.getByTestId('issues-panel').locator('li[data-code="orphan"] button').click();
    await frames(page);
    const s = await scene(page);
    const orphan = expected('broken-mixed').issues.find((i: { code: string }) => i.code === 'orphan').key as Key;
    expect(Math.abs(unit(s, orphan).x - s.width / 2)).toBeLessThan(2);
    expect(unit(s, orphan).state.issue).toBe(true);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`V22 themes: the computed custom properties equal the tokens, ${theme}`, async ({ page }) => {
      await open(page, 'pair', { motion: 'off', theme });
      const got = await page.evaluate((names) => {
        const el = document.querySelector('.gv')!;
        const cs = getComputedStyle(el);
        return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--gv-${n}`).trim().toUpperCase()]));
      }, Object.keys(tokens[theme]));
      expect(got).toEqual(Object.fromEntries(Object.entries(tokens[theme]).map(([k, v]) => [k, v.toUpperCase()])));
    });
  }

  test('V22 themes: switching takes effect at once, and "as the system" follows the system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, 'pair', { motion: 'off', theme: 'system' });
    const surface = () =>
      page.evaluate(() =>
        getComputedStyle(document.querySelector('.gv')!).getPropertyValue('--gv-surface').trim().toUpperCase(),
      );
    expect(await surface()).toBe(tokens.dark.surface);
    await setLook(page, { motion: 'off', theme: 'light' });
    expect(await surface()).toBe(tokens.light.surface);
  });

  for (const scale of [1, 2] as const) {
    test(`V23 export: the PNG at scale ${scale} is the canvas size times ${scale}`, async ({ page }) => {
      await open(page, 'petersen');
      const size = await page.evaluate(async (s) => {
        const blob: Blob = await (window as any).graphview.view.exportPicture({ scale: s, background: s === 1 });
        const bmp = await createImageBitmap(blob);
        return { w: bmp.width, h: bmp.height, type: blob.type };
      }, scale);
      const s = await scene(page);
      expect(size.type).toBe('image/png');
      expect(size.w).toBe(Math.round(s.width * scale));
      expect(size.h).toBe(Math.round(s.height * scale));
    });
  }

  test('V23 export: a view state saved and loaded again gives an equal view state and the same scene', async ({
    page,
  }) => {
    await open(page, 'database-2026-07-24');
    await setView(page, {
      focus: 1,
      radius: 2,
      selection: { units: [79], keypairs: [] },
      camera: { x: 10, y: -20, zoom: 2.5, angle: 30 },
    });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save view' }).click();
    const file = await (await download).path();
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    const before = await scene(page);
    expect(saved).toEqual(await viewState(page));
    await setView(page, {
      focus: null,
      radius: null,
      selection: { units: [], keypairs: [] },
      camera: { x: 0, y: 0, zoom: 1, angle: 0 },
    });
    await page.locator('input[type=file][accept=".json"]').setInputFiles(file);
    await page.waitForTimeout(300);
    await frames(page);
    expect(await viewState(page)).toEqual(saved);
    const after = await scene(page);
    for (const u of before.units) {
      const v = unit(after, u.key);
      expect(Math.abs(v.x - u.x), `unit ${u.key}`).toBeLessThanOrEqual(1);
      expect(Math.abs(v.y - u.y), `unit ${u.key}`).toBeLessThanOrEqual(1);
      expect(v.state).toEqual(u.state);
    }
  });

  test('V23 export: the Save picture button downloads a PNG', async ({ page }) => {
    await open(page, 'pair');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save picture' }).click();
    expect((await download).suggestedFilename()).toBe('graph.png');
    void canvasBox;
  });
});
