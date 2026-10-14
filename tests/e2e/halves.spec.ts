// Gate G11: the halves rule (specification A3 and J2), tested by clicking where the scene says.
import { expect, test } from '@playwright/test';
import {
  click,
  events,
  frames,
  graphFile,
  mulberry32,
  open,
  scene,
  setView,
  unit,
  viewState,
  type Key,
} from './helpers.ts';

function relations(name: string): [Key, Key][] {
  const doc = graphFile(name);
  const seen = new Set<string>();
  const out: [Key, Key][] = [];
  for (const e of doc.edges) {
    const k = JSON.stringify([e.from, e.to]);
    if (seen.has(k) || seen.has(JSON.stringify([e.to, e.from]))) continue;
    seen.add(k);
    out.push([e.from, e.to]);
  }
  return out;
}

function chosen(name: string): [Key, Key][] {
  const all = relations(name);
  if (name !== 'database-2026-07-24') return all;
  // 20 relations of the database graph, chosen by a fixed seed.
  const rnd = mulberry32(20261014);
  const pool = [...all];
  const out: [Key, Key][] = [];
  while (out.length < 20) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

/** Centres a relation and zooms so that its line is `length` pixels long. */
async function frame(page: import('@playwright/test').Page, a: Key, b: Key, length: number, angle: number) {
  const pos = (await events(page, 'layoutsettled')).at(-1)!.payload.positions as { key: Key; x: number; y: number }[];
  const pa = pos.find((p) => p.key === a)!;
  const pb = pos.find((p) => p.key === b)!;
  const cam = (await viewState(page)).camera;
  await setView(page, { camera: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, zoom: cam.zoom, angle } });
  const s = await scene(page);
  const now = Math.hypot(unit(s, b).x - unit(s, a).x, unit(s, b).y - unit(s, a).y);
  await setView(page, {
    camera: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, zoom: (cam.zoom * length) / now, angle },
  });
  return scene(page);
}

for (const name of ['pair', 'triangle', 'path-4', 'database-2026-07-24']) {
  for (const angle of [0, 90, 215]) {
    test(`G11 halves: ${name} at ${angle} degrees: a quarter selects (a, b), three quarters select (b, a)`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await open(page, name);
      for (const [a, b] of chosen(name)) {
        // Each half at least 40 pixels long. The line is 600 pixels, so that neighbouring units
        // of the force layout stay clear of the click points.
        const s = await frame(page, a, b, 600, angle);
        const ua = unit(s, a);
        const ub = unit(s, b);
        const half = s.halves.find((h) => h.from === a && h.to === b)!;
        expect(Math.hypot(half.end.x - half.start.x, half.end.y - half.start.y)).toBeGreaterThanOrEqual(40);
        for (const [q, want] of [
          [0.25, [a, b]],
          [0.75, [b, a]],
        ] as const) {
          await setView(page, { selection: { units: [], keypairs: [] } });
          await click(page, ua.x + q * (ub.x - ua.x), ua.y + q * (ub.y - ua.y));
          expect((await viewState(page)).selection, `${JSON.stringify(a)}-${JSON.stringify(b)} at ${q}`).toEqual({
            units: [],
            keypairs: [want],
          });
        }
      }
    });
  }
  test(`G11 halves: ${name}: where a half is shorter than 24 pixels, a click on the line selects both keypairs`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    // A narrow window: at the smallest zoom, 0.25, a relation of the pair still spans 64 pixels in a
    // 660-pixel canvas. In a 280-pixel canvas each half can be shorter than 24 pixels.
    await page.setViewportSize({ width: 280, height: 500 });
    await open(page, name);
    for (const [a, b] of chosen(name)) {
      // The line is 40 pixels, so each half is 14 pixels from the edge of its unit to the middle.
      const s = await frame(page, a, b, 40, 0);
      const ua = unit(s, a);
      const ub = unit(s, b);
      await setView(page, { selection: { units: [], keypairs: [] } });
      await click(page, (ua.x + ub.x) / 2, (ua.y + ub.y) / 2);
      const got = (await viewState(page)).selection.keypairs.map((k) => JSON.stringify(k)).sort();
      expect(got, `${JSON.stringify(a)}-${JSON.stringify(b)}`).toEqual(
        [JSON.stringify([a, b]), JSON.stringify([b, a])].sort(),
      );
    }
    await frames(page);
  });
}
