// The engine trial's browser tests and measurements (specification H2 and H3).
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Key = string | number;
const ROOT = resolve(import.meta.dirname, '..');
const SHOTS = resolve(ROOT, 'docs/screenshots/trial');
const RESULTS = resolve(import.meta.dirname, 'results');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

function save(engine: string, part: Record<string, unknown>) {
  const file = resolve(RESULTS, `${engine}.json`);
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  writeFileSync(file, JSON.stringify({ ...prev, ...part }, null, 2));
}
const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), frames: s.length };
};

async function open(page: Page, engine: string) {
  await page.goto(`${engine}.html`);
  await page.waitForSelector('body[data-ready="true"]');
}
const call = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window as any).trial[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;
const screen = (page: Page, key: Key) => call<{ x: number; y: number }>(page, 'screen', key);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const db = JSON.parse(readFileSync(resolve(ROOT, 'fixtures/graphs/database-2026-07-24.json'), 'utf8'));
const exp = JSON.parse(readFileSync(resolve(ROOT, 'fixtures/expected/database-2026-07-24.json'), 'utf8'));
const dbRelations: [Key, Key][] = [];
{
  const seen = new Set<string>();
  for (const e of db.edges) {
    const k = [JSON.stringify(e.from), JSON.stringify(e.to)];
    if (seen.has(k.join()) || seen.has([k[1], k[0]].join())) continue;
    seen.add(k.join());
    dbRelations.push([e.from, e.to]);
  }
}
const neighbours = (k: Key) => {
  const out = new Set<string>([JSON.stringify(k)]);
  for (const e of db.edges) {
    if (e.from === k) out.add(JSON.stringify(e.to));
    if (e.to === k) out.add(JSON.stringify(e.from));
  }
  return [...out].sort();
};

for (const engine of ['sigma', 'g6']) {
  test.describe(engine, () => {
    test(`${engine}: six functions on the database graph`, async ({ page }) => {
      await open(page, engine);
      const { firstPictureMs } = await call<{ firstPictureMs: number }>(page, 'load', 'database-2026-07-24', 'force', true);
      await page.screenshot({ path: `${SHOTS}/${engine}-database.png` });
      const passed: Record<string, boolean> = {};
      const notes: Record<string, string> = {};

      // Zoom: distances double at zoom 2.
      await call(page, 'setCamera', 1, 0);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const [a1, b1] = [await screen(page, 1), await screen(page, 7)];
      await call(page, 'setCamera', 2, 0);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const [a2, b2] = [await screen(page, 1), await screen(page, 7)];
      const ratio = Math.hypot(b2.x - a2.x, b2.y - a2.y) / Math.hypot(b1.x - a1.x, b1.y - a1.y);
      passed.zoom = Math.abs(ratio - 2) < 0.06;
      notes.zoom = `distance ratio ${ratio.toFixed(3)} at zoom 2`;

      // Rotate: the vector from unit 1 to unit 7 turns by 90 degrees.
      await call(page, 'setCamera', 1, 90);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const [a3, b3] = [await screen(page, 1), await screen(page, 7)];
      const ang = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.atan2(q.y - p.y, q.x - p.x);
      let turn = ((ang(a3, b3) - ang(a1, b1)) * 180) / Math.PI;
      turn = ((turn % 360) + 540) % 360 - 180;
      passed.rotate = Math.abs(Math.abs(turn) - 90) < 2;
      notes.rotate = `turned ${turn.toFixed(1)} degrees (positive is clockwise on screen)`;
      await page.screenshot({ path: `${SHOTS}/${engine}-rotated.png` });
      await call(page, 'setCamera', 1, 0);

      // Hover with neighbours.
      await call(page, 'frameRelation', 1, 7, 300);
      const p1 = await screen(page, 1);
      await page.mouse.move(p1.x, p1.y);
      await page.waitForTimeout(300);
      const lit = (await call<Key[]>(page, 'highlighted')).map((k) => JSON.stringify(k)).sort();
      passed.hover = JSON.stringify(lit) === JSON.stringify(neighbours(1));
      notes.hover = `${lit.length} lit, ${neighbours(1).length} expected`;
      await page.screenshot({ path: `${SHOTS}/${engine}-hover.png` });
      await page.mouse.move(2, 2);
      await page.waitForTimeout(200);

      // Relations in two halves: one click per half of the relation 1 to 7.
      await call(page, 'frameRelation', 1, 7, 300);
      const [h1, h7] = [await screen(page, 1), await screen(page, 7)];
      const clicks: string[] = [];
      for (const q of [0.25, 0.75]) {
        await page.evaluate(() => ((window as any).trial.lastClick = null));
        await page.mouse.click(h1.x + q * (h7.x - h1.x), h1.y + q * (h7.y - h1.y));
        await page.waitForTimeout(150);
        clicks.push(await page.evaluate(() => (window as any).trial.lastClick));
      }
      passed.halves = clicks[0] === '1\t7' && clicks[1] === '7\t1';
      notes.halves = `clicks gave ${JSON.stringify(clicks)}`;
      await page.screenshot({ path: `${SHOTS}/${engine}-halves.png` });

      // One group as a hull: units 7 to 32.
      await call(page, 'setCamera', 1, 0);
      const { drawn } = await call<{ drawn: boolean }>(page, 'hull', Array.from({ length: 26 }, (_, i) => i + 7));
      passed.hull = drawn;
      notes.hull = drawn ? 'drawn' : 'not drawn';
      await page.screenshot({ path: `${SHOTS}/${engine}-hull.png` });

      // Rings around unit 1: each unit sits on its ring.
      const r = await call<{ circles: number; spacingPx: number }>(page, 'rings', 1);
      const centre = await screen(page, 1);
      const ringsExp: Key[][] = exp.rings.find((e: any) => e.focus === 1 && e.graph === 'stored').rings;
      let worst = 0;
      for (let k = 0; k < ringsExp.length; k++) {
        for (const key of ringsExp[k]) {
          const p = await screen(page, key);
          worst = Math.max(worst, Math.abs(Math.hypot(p.x - centre.x, p.y - centre.y) - k * r.spacingPx));
        }
      }
      passed.rings = r.circles === ringsExp.length - 1 && worst <= 1.5;
      notes.rings = `${r.circles} circles, worst distance error ${worst.toFixed(2)} px`;
      await page.screenshot({ path: `${SHOTS}/${engine}-rings.png` });

      save(engine, { functions: passed, notes, firstPictureDatabaseMs: +firstPictureMs.toFixed(1) });
      expect(passed).toBeTruthy();
    });

    test(`${engine}: halves accuracy, 100 seeded clicks`, async ({ page }) => {
      await open(page, engine);
      await call(page, 'load', 'database-2026-07-24', 'force', true);
      const rnd = mulberry32(20261014);
      let right = 0;
      const misses: string[] = [];
      for (let i = 0; i < 100; i++) {
        const [a, b] = dbRelations[Math.floor(rnd() * dbRelations.length)];
        const q = rnd() < 0.5 ? 0.25 : 0.75;
        await call(page, 'frameRelation', a, b, 400);
        const [pa, pb] = [await screen(page, a), await screen(page, b)];
        await page.evaluate(() => ((window as any).trial.lastClick = null));
        await page.mouse.click(pa.x + q * (pb.x - pa.x), pa.y + q * (pb.y - pa.y));
        await page.waitForTimeout(400);
        const got = await page.evaluate(() => (window as any).trial.lastClick);
        const want = q === 0.25 ? `${JSON.stringify(a)}\t${JSON.stringify(b)}` : `${JSON.stringify(b)}\t${JSON.stringify(a)}`;
        if (got === want) right++;
        else misses.push(`${want} got ${got}`);
      }
      save(engine, { halvesAccuracy: right / 100, halvesMisses: misses.slice(0, 10) });
    });

    test(`${engine}: speed`, async ({ page }) => {
      await open(page, engine);
      await call(page, 'load', 'database-2026-07-24', 'force', false);
      const dbZoom = stats(await call<number[]>(page, 'frames', 'zoom'));
      const dbRotate = stats(await call<number[]>(page, 'frames', 'rotate'));
      const cdp = await page.context().newCDPSession(page);
      const { firstPictureMs } = await call<{ firstPictureMs: number }>(page, 'load', 'random-10k', 'given', false);
      await page.screenshot({ path: `${SHOTS}/${engine}-random-10k.png` });
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
      const rZoom = stats(await call<number[]>(page, 'frames', 'zoom'));
      const rRotate = stats(await call<number[]>(page, 'frames', 'rotate'));
      save(engine, {
        firstPictureRandomMs: +firstPictureMs.toFixed(1),
        heapAfterRandomMB: +(heap.usedSize / 2 ** 20).toFixed(1),
        frames: { database: { zoom: dbZoom, rotate: dbRotate }, random: { zoom: rZoom, rotate: rRotate } },
      });
    });
  });
}
