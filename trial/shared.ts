// Shared helpers for the engine trial (specification Part H). Engine-independent.
import { loadGraph, rings as ringsOf, keyId, type Graph, type Key } from '../module/core/index.ts';

export interface TrialEngine {
  load(name: string, mode: 'force' | 'given', halves: boolean): Promise<{ firstPictureMs: number }>;
  setCamera(zoom: number, angleDeg: number): void;
  /** Centres the relation (a, b) and zooms so that it is `lengthPx` long on screen. */
  frameRelation(a: Key, b: Key, lengthPx: number): Promise<void>;
  screen(key: Key): { x: number; y: number };
  rings(focus: Key): Promise<{ circles: number; spacingPx: number }>;
  hull(keys: Key[]): Promise<{ drawn: boolean }>;
  highlighted(): Key[];
  lastClick: string | null;
  frames(kind: 'zoom' | 'rotate'): Promise<number[]>;
}

const urls = import.meta.glob('../fixtures/graphs/*.json', { query: '?url', import: 'default', eager: true });

export async function fixture(name: string): Promise<{ graph: Graph; doc: Record<string, unknown> }> {
  const url = urls[`../fixtures/graphs/${name}.json`] as string;
  const doc = await (await fetch(url)).json();
  const r = loadGraph(doc);
  if (!r.ok) throw new Error(`refused ${name}`);
  return { graph: r.graph, doc };
}

export const id = keyId;

/** Relations as unordered pairs, each once, in keypair order. */
export function relations(graph: Graph): [Key, Key][] {
  const seen = new Set<string>();
  const out: [Key, Key][] = [];
  for (const [a, b] of graph.keypairs) {
    const k1 = id(a) + '\t' + id(b);
    const k2 = id(b) + '\t' + id(a);
    if (seen.has(k1) || seen.has(k2)) continue;
    seen.add(k1);
    out.push([a, b]);
  }
  return out;
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

/** Seeded starting positions for a force layout. */
export function seededPositions(graph: Graph, seed = 1): Map<string, { x: number; y: number }> {
  const rnd = mulberry32(seed);
  return new Map(graph.units.map((k) => [id(k), { x: rnd() * 100, y: rnd() * 100 }]));
}

/** Ring layout: ring k on a circle of radius k * spacing, spread by angle. */
export function ringLayout(graph: Graph, focus: Key, spacing: number): Map<string, { x: number; y: number; ring: number }> {
  const { rings, beyond } = ringsOf(graph, focus);
  const out = new Map<string, { x: number; y: number; ring: number }>();
  rings.forEach((ring, k) => {
    ring.forEach((key, i) => {
      const t = (2 * Math.PI * i) / ring.length - Math.PI / 2;
      out.set(id(key), { x: k * spacing * Math.cos(t), y: k * spacing * Math.sin(t), ring: k });
    });
  });
  const r = (rings.length + 1) * spacing;
  beyond.forEach((key, i) => {
    const t = (2 * Math.PI * i) / Math.max(1, beyond.length);
    out.set(id(key), { x: r * Math.cos(t), y: r * Math.sin(t), ring: -1 });
  });
  return out;
}

/** Convex hull (monotone chain) of screen points. */
export function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: typeof p = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Runs an animation for two seconds and returns the frame times in milliseconds. */
export function animate(step: (t: number) => void): Promise<number[]> {
  return new Promise((resolve) => {
    const times: number[] = [];
    let start = 0;
    let last = 0;
    const frame = (now: number) => {
      if (!start) start = last = now;
      else times.push(now - last);
      last = now;
      const t = Math.min(1, (now - start) / 2000);
      step(t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve(times);
    };
    requestAnimationFrame(frame);
  });
}

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export const VIEWPOINT_TYPES: Key[] = Array.from({ length: 26 }, (_, i) => i + 7);
export const COLOURS = { unit: '#74859A', half: '#74859A', out: '#2A78D6', ring: '#7D8E9C', hull: '#17A070', dim: '#D5DDE2' };
