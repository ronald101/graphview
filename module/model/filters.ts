// Multi-variable filtering (specification 6.7): a time window and a weight threshold, compounded.
import { keyId, keypairId, type Graph, type Key } from '../core/index.ts';
import type { Filters } from './contracts.ts';
import { timeValue } from './schema.ts';

export const NO_FILTERS: Filters = { timeField: null, from: null, to: null, weightField: null, threshold: null };

const inWindow = (t: number | null, f: Filters) =>
  t === null || ((f.from === null || t >= f.from) && (f.to === null || t <= f.to));

/** Whether a unit passes the time window. A row without a time always passes. */
export function unitPasses(g: Graph, k: Key, f: Filters): boolean {
  if (!f.timeField) return true;
  const v = g.unitInfo.get(keyId(k))?.attrs?.[f.timeField];
  return inWindow(v === undefined ? null : timeValue(v, f.timeField), f);
}

/** Whether a keypair passes the time window. */
export function keypairPasses(g: Graph, a: Key, b: Key, f: Filters): boolean {
  if (!f.timeField) return true;
  const v = g.keypairInfo.get(keypairId(a, b))?.attrs?.[f.timeField];
  return inWindow(v === undefined ? null : timeValue(v, f.timeField), f);
}

export function weightOf(g: Graph, a: Key, b: Key, field: string | null): number | null {
  if (!field) return null;
  const v = g.keypairInfo.get(keypairId(a, b))?.attrs?.[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** The range of a numeric field over the keypairs, or of a time field over all rows. */
export function range(values: (number | null)[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === null) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * A relation's line is super-threshold when one of its keypairs reaches the threshold; its
 * strength, 0 to 1, grows with the larger weight. Without a threshold every line counts as
 * super-threshold with strength 0.
 */
export function lineWeight(
  wa: number | null,
  wb: number | null,
  f: Filters,
  span: { min: number; max: number } | null,
) {
  if (f.threshold === null || !f.weightField) return { above: true, strength: 0 };
  const w = Math.max(wa ?? -Infinity, wb ?? -Infinity);
  const above = w >= f.threshold;
  const strength = span && span.max > span.min && above ? (w - span.min) / (span.max - span.min) : above ? 1 : 0;
  return { above, strength };
}

/** The range of a time field over all rows, or of a weight field over the keypairs. */
export function fieldRange(g: Graph, field: string, kind: 'time' | 'weight'): { min: number; max: number } | null {
  if (kind === 'weight') return range(g.keypairs.map(([a, b]) => weightOf(g, a, b, field)));
  const values: (number | null)[] = [];
  const add = (v: unknown) => values.push(v === undefined ? null : timeValue(v, field));
  for (const k of g.units) add(g.unitInfo.get(keyId(k))?.attrs?.[field]);
  for (const [a, b] of g.keypairs) add(g.keypairInfo.get(keypairId(a, b))?.attrs?.[field]);
  return range(values);
}
