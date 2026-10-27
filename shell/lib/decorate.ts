// Adds types, weights and times where a graph lacks them (specification 8.7), so that
// the palette, the filters and the hulls have something to show. Only what a row lacks is added:
// a unit with a type keeps it. Seeded: the same graph, options and seed give the same result.
import { keyId, keypairId, type Key } from '../../module/index.ts';
import { mulberry32 } from './random.ts';

export interface DecorateOptions {
  /** How many unit types to deal out: type_1, type_2 and so on. */
  unitTypes: number;
  /** How many relation types to deal out; each is a complementary pair, such as rel_ab and rel_ba. */
  relationTypes: number;
  /** Weights fall between these two values. */
  weights: [number, number];
  /** Times fall between these two moments, in milliseconds. */
  times: [number, number];
}

const DAY = 86400000;

export const DECORATE_DEFAULTS: DecorateOptions = {
  unitTypes: 5,
  relationTypes: 4,
  weights: [0, 1],
  times: [Date.UTC(2026, 0, 1), Date.UTC(2026, 11, 31)],
};

/** At most 13 relation types: two letters each, a to z. */
export const MAX_RELATION_TYPES = 13;
export const MAX_UNIT_TYPES = 64;

const TYPE_FIELDS = ['type', 'kind', 'category', 'archetype', 'group', 'class'];
const TIME_FIELD = /^(time|timestamp|date|created|updated|at|when|created_at|updated_at)$/i;

/** The names of relation type i: the forward one and its complement, such as rel_ab and rel_ba. */
export function relationTypeNames(i: number): [string, string] {
  const x = String.fromCharCode(97 + 2 * i);
  const y = String.fromCharCode(98 + 2 * i);
  return [`rel_${x}${y}`, `rel_${y}${x}`];
}

type Row = Record<string, unknown> & { attrs?: Record<string, unknown> };
const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const attrsOf = (r: Row) => (isRow(r.attrs) ? r.attrs : {});
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const timed = (r: Row) => Object.entries(attrsOf(r)).some(([k, v]) => TIME_FIELD.test(k) || isDate(v));
/** A row's own date in milliseconds, when it has one that reads. */
const dateOf = (r: Row) => {
  const t = Date.parse(Object.values(attrsOf(r)).find(isDate) ?? '');
  return Number.isFinite(t) ? t : undefined;
};
/** The field the rows name their type in: the first type field any row has, else type. */
const typeField = (rows: unknown[]) =>
  TYPE_FIELDS.find((f) => rows.some((r) => isRow(r) && attrsOf(r)[f] !== undefined)) ?? 'type';

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Returns a copy of the document in which every row has a type, a weight and a time. */
export function decorate<T>(doc: T, seed: number, options: DecorateOptions = DECORATE_DEFAULTS): T {
  if (!isRow(doc) || !Array.isArray(doc.vertices) || !Array.isArray(doc.edges)) return doc;
  const [unitField, keypairField] = [typeField(doc.vertices), typeField(doc.edges)];
  const rng = mulberry32(seed ^ 0x2f6b4a1d);
  const pick = (n: number) => Math.floor(rng.next() * n);
  const unitTypes = Math.max(1, Math.min(MAX_UNIT_TYPES, Math.round(options.unitTypes)));
  const relationTypes = Math.max(1, Math.min(MAX_RELATION_TYPES, Math.round(options.relationTypes)));
  const [w0, w1] = [Math.min(...options.weights), Math.max(...options.weights)];
  const [t0, t1] = [Math.min(...options.times), Math.max(...options.times)];
  const days = Math.max(0, Math.floor((t1 - t0) / DAY));
  const time = new Map<string, number>();
  const vertices = doc.vertices.map((v: unknown) => {
    if (!isRow(v)) return v;
    const attrs = { ...attrsOf(v) };
    if (attrs[unitField] === undefined) attrs[unitField] = `type_${1 + pick(unitTypes)}`;
    let t = dateOf(v);
    if (!timed(v)) {
      t = t0 + pick(days + 1) * DAY;
      attrs.created = iso(t);
    }
    if (t !== undefined && v.key !== undefined) time.set(keyId(v.key as Key), t);
    return { ...v, attrs };
  });
  // A relation without types takes one pair: the first keypair met the forward name, its reverse the
  // complement. A keypair whose reverse brings a type keeps what it has.
  const typedKeypairs = new Set(
    doc.edges
      .filter((e): e is Row => isRow(e) && attrsOf(e)[keypairField] !== undefined)
      .map((e) => keypairId(e.from as Key, e.to as Key)),
  );
  const relationOf = new Map<string, [string, string]>();
  const edges = doc.edges.map((e: unknown) => {
    if (!isRow(e)) return e;
    const attrs = { ...attrsOf(e) };
    const [a, b] = [e.from as Key, e.to as Key];
    if (attrs[keypairField] === undefined && !typedKeypairs.has(keypairId(b, a))) {
      const reverse = relationOf.get(keypairId(b, a));
      if (reverse) attrs[keypairField] = reverse[1];
      else {
        const names = relationTypeNames(pick(relationTypes));
        relationOf.set(keypairId(a, b), names);
        attrs[keypairField] = names[0];
      }
    }
    if (typeof attrs.weight !== 'number') attrs.weight = Math.round((w0 + rng.next() * (w1 - w0)) * 100) / 100;
    if (!timed(e)) {
      // A keypair is no older than its units, and no later than the last moment.
      const born = Math.max(time.get(keyId(a)) ?? t0, time.get(keyId(b)) ?? t0);
      attrs.created = iso(born + pick(Math.max(0, Math.floor((t1 - born) / DAY)) + 1) * DAY);
    }
    return { ...e, attrs };
  });
  const meta = isRow(doc.meta) ? doc.meta : {};
  return { ...doc, meta: { ...meta, decorated: { ...options } }, vertices, edges } as T;
}
