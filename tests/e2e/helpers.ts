// Helpers for the browser tests: they drive the shell's production build through
// window.graphview, and read the module's scene (specification D8).
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Look, Scene, ViewState } from '../../module/index.ts';

export type Key = string | number;
const FIXTURES = new URL('../../fixtures/', import.meta.url);
export const expected = (name: string) => JSON.parse(readFileSync(new URL(`expected/${name}.json`, FIXTURES), 'utf8'));
export const graphFile = (name: string) => JSON.parse(readFileSync(new URL(`graphs/${name}.json`, FIXTURES), 'utf8'));
export const index = (): { fixture: string; load: string; units: number; issues: number }[] =>
  JSON.parse(readFileSync(new URL('index.json', FIXTURES), 'utf8'));

/** Opens the shell with an example and waits until its layout has settled. Motion is off unless asked. */
export async function open(page: Page, example = 'pair', look: Record<string, unknown> = { motion: 'off' }) {
  await page.goto('./');
  await page.waitForFunction(() => (window as any).graphview?.view && (window as any).graphview.settled() > 0, null, {
    timeout: 30000,
  });
  await page.evaluate((l) => (window as any).graphview.setLook(l), look);
  if (example !== 'database-2026-07-24') await load(page, example);
  await frames(page);
}

export async function load(page: Page, example: string, view?: Partial<ViewState>) {
  await page.evaluate(([id, v]) => (window as any).graphview.loadExample(id, v), [example, view] as const);
  await frames(page);
}

export const setLook = (page: Page, look: Record<string, unknown>) =>
  page.evaluate((l) => (window as any).graphview.setLook(l), look).then(() => frames(page));

/** Calls a command of the component. */
export function command<T = unknown>(page: Page, name: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(([n, a]) => (window as any).graphview.view[n as string](...(a as unknown[])), [
    name,
    args,
  ] as const) as Promise<T>;
}

export const scene = (page: Page) => command<Scene>(page, 'getScene');
export const viewState = (page: Page) => command<ViewState>(page, 'getViewState');
export const setView = (page: Page, v: Partial<ViewState>) => command(page, 'setViewState', v).then(() => frames(page));

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

/** The canvas's position on the page, to turn scene coordinates into mouse coordinates. */
export async function canvasBox(page: Page) {
  const box = await page.getByTestId('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return box;
}

export const unit = (s: Scene, key: Key) => {
  const u = s.units.find((x) => x.key === key);
  if (!u) throw new Error(`no unit ${JSON.stringify(key)}`);
  return u;
};

export const events = (page: Page, name?: string) =>
  page.evaluate(
    (n) => (window as any).graphview.log.filter((e: { name: string }) => !n || e.name === n),
    name,
  ) as Promise<{ name: string; payload: any }[]>;
export const clearEvents = (page: Page) => page.evaluate(() => ((window as any).graphview.log.length = 0));

export async function click(page: Page, x: number, y: number, modifiers: 'Shift'[] = []) {
  const b = await canvasBox(page);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(b.x + x, b.y + y);
  for (const m of modifiers) await page.keyboard.up(m);
  await frames(page);
}

/** Sets the camera so that a relation is centred and `length` pixels long on screen, at an angle. */
export async function frameRelation(page: Page, a: Key, b: Key, length: number, angle = 0) {
  await setView(page, { camera: { ...(await viewState(page)).camera, angle } });
  let s = await scene(page);
  const ua = unit(s, a);
  const ub = unit(s, b);
  const vs = await viewState(page);
  const now = Math.hypot(ub.x - ua.x, ub.y - ua.y);
  // Centre on the middle of the relation, in graph coordinates.
  const pos = new Map(
    (
      await page.evaluate(
        () =>
          (window as any).graphview.log.filter((e: any) => e.name === 'layoutsettled').at(-1)?.payload.positions ?? [],
      )
    ).map((p: any) => [JSON.stringify(p.key), p]),
  );
  const pa = pos.get(JSON.stringify(a)) as { x: number; y: number } | undefined;
  const pb = pos.get(JSON.stringify(b)) as { x: number; y: number } | undefined;
  const centre = pa && pb ? { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } : { x: vs.camera.x, y: vs.camera.y };
  await setView(page, { camera: { x: centre.x, y: centre.y, zoom: (vs.camera.zoom * length) / now, angle } });
  s = await scene(page);
  return s;
}

export function expectNear(actual: number, want: number, tolerance: number, what = '') {
  expect(Math.abs(actual - want), `${what}: ${actual} against ${want}`).toBeLessThanOrEqual(tolerance);
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type { Look, Scene, ViewState };
