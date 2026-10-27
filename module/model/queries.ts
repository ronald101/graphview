// Questions about a loaded graph and its paths that need nothing else of the view.
import { keyId, keypairId, type Graph, type Key, type PathSetResult } from '../core/index.ts';
import type { PathChoice, PathStep, Perspective, PlaneCounts } from './contracts.ts';
import { plane } from './depth.ts';
import { weightOf } from './filters.ts';

/** A unit's name: its label, or its key as JSON text (1 for the number, "1" for the text). */
export function labelOf(g: Graph | null, k: Key): string {
  return g?.unitInfo.get(keyId(k))?.label ?? (typeof k === 'string' ? JSON.stringify(k) : String(k));
}

/** The unit a person typed: its label, or its key as JSON text, or a bare word for a text key. */
export function findUnit(g: Graph | null, index: ReadonlyMap<string, number>, text: string): Key | null {
  const t = text.trim();
  if (!g || !t) return null;
  const named = g.units.find((k) => g.unitInfo.get(keyId(k))?.label === t);
  if (named !== undefined) return named;
  try {
    const k: unknown = JSON.parse(t);
    if ((typeof k === 'number' || typeof k === 'string') && index.has(keyId(k))) return k;
  } catch {
    // Not JSON: a bare word can still name a text key.
  }
  return index.has(keyId(t)) ? t : null;
}

/** A unit's keypairs for stepping by keyboard: outgoing ones first, then incoming ones, each in file order. */
export function keypairsOf(g: Graph | null, k: Key): [Key, Key][] {
  const id = keyId(k);
  const kp = g?.keypairs ?? [];
  return [...kp.filter(([a]) => keyId(a) === id), ...kp.filter(([, b]) => keyId(b) === id)];
}

/** The chosen path of a path set, as its units. */
export function activePath(paths: PathSetResult | null, choice: PathChoice | null): Key[] | null {
  if (!paths || !choice) return null;
  return paths.lengths.find((l) => l.length === choice.length)?.paths[choice.index] ?? null;
}

/** Units per plane around the root (specification 7.2). */
export function planeCounts(degrees: number[] | null): PlaneCounts {
  const c: PlaneCounts = { first: 0, second: 0, third: 0, farBack: 0, deepest: null };
  if (!degrees) return c;
  let deepest = 0;
  for (const d of degrees) {
    if (d < 0) continue;
    deepest = Math.max(deepest, d);
    if (d === 0) continue;
    const p = plane(d);
    if (p === 0) c.first++;
    else if (p === 1) c.second++;
    else if (p === 2) c.third++;
    else c.farBack++;
  }
  c.deepest = deepest;
  return c;
}

/** The steps of a path, each with the keypairs to the next unit and back: their type labels and weights. */
export function pathSteps(
  g: Graph,
  seq: Key[],
  label: (k: Key) => string,
  typeLabel: (a: Key, b: Key) => string | null,
  weightField: string | null,
): PathStep[] {
  const side = (a: Key, b: Key) =>
    g.keypairInfo.has(keypairId(a, b)) ? { type: typeLabel(a, b), weight: weightOf(g, a, b, weightField) } : null;
  return seq.map((k, i) => ({
    key: k,
    label: label(k),
    to: i + 1 < seq.length ? side(k, seq[i + 1]) : null,
    from: i + 1 < seq.length ? side(seq[i + 1], k) : null,
  }));
}

/**
 * An interface's perspectives: its relation seen from each end toward the other, with the pair
 * type the rule gives, or null. One end gives one perspective; other than one or two ends, none.
 */
export function perspectivesOf(
  g: Graph,
  iface: Key,
  ends: Key[],
  rule?: (g: Graph, iface: Key, from: Key, to: Key) => string | null,
): Perspective[] | null {
  const seen = (from: Key, to: Key): Perspective => ({ from, to, type: rule?.(g, iface, from, to) ?? null });
  if (ends.length === 1) return [seen(ends[0], ends[0])];
  return ends.length === 2 ? [seen(ends[0], ends[1]), seen(ends[1], ends[0])] : null;
}
