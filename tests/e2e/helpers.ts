// Helpers for the browser tests: they drive the shell's production build through window.graphview,
// which holds the model and the canvas, and read the canvas's scene snapshot.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { loadGraph, type Graph } from '../../module/core/index.ts';
import type { SceneSnapshot } from '../../module/index.ts';

export type Key = string | number;
export type Snap = SceneSnapshot;
/** The public example made from the database graph. */
export const SAMPLE = 'sample';
export const SAMPLE_SOURCE = 'database-2026-07-24';

const FIXTURES = new URL('../../fixtures/', import.meta.url);
export const expected = (name: string) => JSON.parse(readFileSync(new URL(`expected/${name}.json`, FIXTURES), 'utf8'));
export const graphFile = (name: string) => JSON.parse(readFileSync(new URL(`graphs/${name}.json`, FIXTURES), 'utf8'));
export const index = (): { fixture: string; load: string; units: number; issues: number }[] =>
  JSON.parse(readFileSync(new URL('index.json', FIXTURES), 'utf8'));

export function graphOf(name: string): Graph {
  const r = loadGraph(graphFile(name));
  if (!r.ok) throw new Error(r.message);
  return r.graph;
}

/** Opens the shell, which shows the sample first, then an example if asked. Motion is off unless asked. */
export async function open(page: Page, example = SAMPLE, look: Record<string, unknown> = { motion: 'off' }) {
  await page.goto('./');
  await page.waitForFunction(() => (window as any).graphview?.ready() > 0, null, { timeout: 30000 });
  await page.evaluate((l) => (window as any).graphview.setLook(l), look);
  if (example !== SAMPLE) await page.evaluate((id) => (window as any).graphview.loadExample(id), example);
  await settled(page);
}

/** Waits until the scene has finished its transition, and a few frames more. */
export async function settled(page: Page) {
  await page.evaluate(() => (window as any).graphview.canvas().whenSettled());
  await frames(page);
}

/** Calls a method of the model and waits for the scene to settle. */
export async function call<T = unknown>(page: Page, name: string, ...args: unknown[]): Promise<T> {
  const r = await page.evaluate(
    async ([n, a]) => {
      const out = await (window as any).graphview.model[n as string](...(a as unknown[]));
      return out === undefined ? null : JSON.parse(JSON.stringify(out));
    },
    [name, args] as const,
  );
  await settled(page);
  return r as T;
}

/** Reads a field of the model, as JSON. */
export const read = <T = unknown>(page: Page, field: string): Promise<T> =>
  page.evaluate((f) => JSON.parse(JSON.stringify((window as any).graphview.model[f] ?? null)), field) as Promise<T>;

export const snap = (page: Page) => page.evaluate(() => (window as any).graphview.canvas().getScene()) as Promise<Snap>;

/** What a canvas point holds, without clicking. */
export const pickAt = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => (window as any).graphview.canvas().pickAt(x, y), [x, y] as const);

/** Waits for a few frames, so that the picture and the scene are up to date. */
export const frames = (page: Page, n = 3) =>
  page.evaluate(
    (k) =>
      new Promise<void>((resolve) => {
        let left = k;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );

/** Clicks a canvas point with the mouse, with Shift if asked. */
export async function click(page: Page, x: number, y: number, shift = false) {
  const b = (await page.getByTestId('canvas').boundingBox())!;
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(b.x + x, b.y + y);
  if (shift) await page.keyboard.up('Shift');
  await frames(page);
}

/** The colour of the WebGL picture at a canvas point. */
export function pixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.evaluate(
    ([x, y]) => {
      const c = document.querySelector('.gv-gl canvas') as HTMLCanvasElement;
      const k = c.width / c.clientWidth;
      const t = document.createElement('canvas');
      t.width = c.width;
      t.height = c.height;
      const g = t.getContext('2d')!;
      g.drawImage(c, 0, 0);
      return [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)];
    },
    [x, y] as const,
  );
}

export const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const close = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);

export const unit = (s: Snap, key: Key) => {
  const u = s.units.find((x) => x.key === key);
  if (!u) throw new Error(`no unit ${JSON.stringify(key)}`);
  return u;
};
export const lineOf = (s: Snap, a: Key, b: Key) =>
  s.lines.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))!;
export const chevron = (s: Snap, from: Key, to: Key) => s.chevrons.find((c) => c.from === from && c.to === to)!;

/** The longest line on screen whose two chevrons are both shown. */
export function longestLine(s: Snap) {
  let best: Snap['lines'][number] | null = null;
  let length = 0;
  for (const l of s.lines) {
    if (!l.keypairs[0] || !l.keypairs[1] || !chevron(s, l.a, l.b).visible || !chevron(s, l.b, l.a).visible) continue;
    const a = unit(s, l.a);
    const b = unit(s, l.b);
    const d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
    if (d > length) [best, length] = [l, d];
  }
  return { line: best!, length };
}

/** Sets a range input's value as a person dragging it would. */
export const slide = (page: Page, label: string, value: string | number) =>
  page.getByLabel(label, { exact: true }).evaluate((el: HTMLInputElement, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

export const words = (n: number, one: string, many: string) =>
  n === 0 ? `no ${many}` : `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/**
 * Waits until the page draws quick frames again, then leaves it, so that a heavy scene's last
 * software-rendered frames finish inside the test rather than under the next test's new context.
 */
export async function release(page: Page) {
  await page.evaluate(async () => {
    let quick = 0;
    let last = performance.now();
    while (quick < 5) {
      const t = await new Promise<number>((r) => requestAnimationFrame(r));
      quick = t - last < 100 ? quick + 1 : 0;
      last = t;
    }
  });
  await page.goto('about:blank');
}
