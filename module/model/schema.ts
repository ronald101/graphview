// Schema reflection (specification 6.6): the types, timestamps and weights that the rows
// carry, found once on loading.
import { keyId, keypairId, type Graph, type Key } from '../core/index.ts';

export interface Schema {
  /** The attribute that names a unit's type, or null when no unit has one. */
  unitTypeField: string | null;
  keypairTypeField: string | null;
  /** Attributes holding timestamps, on units or keypairs. */
  timeFields: string[];
  /** Numeric attributes of keypairs, other than timestamps. */
  weightFields: string[];
}

export const EMPTY_SCHEMA: Schema = { unitTypeField: null, keypairTypeField: null, timeFields: [], weightFields: [] };

const TYPE_NAMES = ['type', 'kind', 'category', 'archetype', 'group', 'class'];
const TIME_NAMES = /^(time|timestamp|date|created|updated|at|when|created_at|updated_at)$/i;

/** A timestamp in milliseconds: an ISO date text, or a number in a field named like a time. */
export function timeValue(v: unknown, field: string): number | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}(-\d{2})?/.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === 'number' && Number.isFinite(v) && TIME_NAMES.test(field)) return v;
  return null;
}

const attrsOfUnit = (g: Graph, k: Key) => g.unitInfo.get(keyId(k))?.attrs ?? {};
const attrsOfPair = (g: Graph, a: Key, b: Key) => g.keypairInfo.get(keypairId(a, b))?.attrs ?? {};

/** A type as text, for the palette: numbers and booleans become their text. */
export function typeText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function pickTypeField(rows: Record<string, unknown>[]): string | null {
  for (const name of TYPE_NAMES) {
    const values = new Set<string>();
    let seen = 0;
    for (const r of rows) {
      const t = typeText(r[name]);
      if (t === null || typeof r[name] === 'object') continue;
      seen++;
      values.add(t);
    }
    if (seen === 0) continue;
    // A field named type is the type. Another name counts when it names fewer groups than rows.
    if (name === 'type' || values.size < seen) return name;
  }
  return null;
}

export function reflectSchema(g: Graph): Schema {
  const unitRows = g.units.map((k) => attrsOfUnit(g, k));
  const edgeRows = g.keypairs.map(([a, b]) => attrsOfPair(g, a, b));
  const timeFields = new Set<string>();
  const numeric = new Map<string, Set<number>>();
  for (const rows of [unitRows, edgeRows]) {
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) if (timeValue(v, k) !== null) timeFields.add(k);
    }
  }
  for (const r of edgeRows) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || timeFields.has(k)) continue;
      if (!numeric.has(k)) numeric.set(k, new Set());
      numeric.get(k)!.add(v);
    }
  }
  const weightFields = [...numeric].filter(([, s]) => s.size >= 2).map(([k]) => k);
  weightFields.sort((x, y) => (x === 'weight' ? -1 : y === 'weight' ? 1 : 0));
  return {
    unitTypeField: pickTypeField(unitRows),
    keypairTypeField: pickTypeField(edgeRows),
    timeFields: [...timeFields],
    weightFields,
  };
}
