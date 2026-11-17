// Schema reflection (specification 6.6): the types, timestamps and weights that the rows
// carry, found once on loading.
import { keyId, keypairId, type Graph, type Key } from '../core/index.ts';
import { DATE_PATTERN, TIME_NAMES, TYPE_NAMES } from '../settings/defaults.ts';

/** How the schema is read: the settings of the group "Reading the data". */
export interface SchemaRules {
  typeFields: readonly string[];
  timeNames: RegExp;
  datePattern: RegExp;
  weightMinDistinct: number;
  weightFirst: string;
}

export const SCHEMA_RULES: SchemaRules = {
  typeFields: TYPE_NAMES,
  timeNames: new RegExp(TIME_NAMES, 'i'),
  datePattern: new RegExp(DATE_PATTERN),
  weightMinDistinct: 2,
  weightFirst: 'weight',
};

export interface Schema {
  /** The attribute that names a unit's type, or null when no unit has one. */
  unitTypeField: string | null;
  keypairTypeField: string | null;
  /** Attributes holding timestamps, on units or keypairs. */
  timeFields: string[];
  /** Numeric attributes of keypairs, other than timestamps. */
  weightFields: string[];
  /** The rules it was read with, which the filters read times with too. */
  rules: SchemaRules;
}

export const EMPTY_SCHEMA: Schema = {
  unitTypeField: null,
  keypairTypeField: null,
  timeFields: [],
  weightFields: [],
  rules: SCHEMA_RULES,
};

/** A timestamp in milliseconds: an ISO date text, or a number in a field named like a time. */
export function timeValue(v: unknown, field: string, rules: SchemaRules = SCHEMA_RULES): number | null {
  if (typeof v === 'string' && rules.datePattern.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === 'number' && Number.isFinite(v) && rules.timeNames.test(field)) return v;
  return null;
}

const attrsOfUnit = (g: Graph, k: Key) => g.unitInfo.get(keyId(k))?.attrs ?? {};
const attrsOfPair = (g: Graph, a: Key, b: Key) => g.keypairInfo.get(keypairId(a, b))?.attrs ?? {};

/** A type as text, for the palette: numbers and booleans become their text. */
export function typeText(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function pickTypeField(rows: Record<string, unknown>[], names: readonly string[]): string | null {
  for (const name of names) {
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

export function reflectSchema(g: Graph, rules: SchemaRules = SCHEMA_RULES): Schema {
  const unitRows = g.units.map((k) => attrsOfUnit(g, k));
  const edgeRows = g.keypairs.map(([a, b]) => attrsOfPair(g, a, b));
  const timeFields = new Set<string>();
  const numeric = new Map<string, Set<number>>();
  for (const rows of [unitRows, edgeRows]) {
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) if (timeValue(v, k, rules) !== null) timeFields.add(k);
    }
  }
  for (const r of edgeRows) {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || timeFields.has(k)) continue;
      if (!numeric.has(k)) numeric.set(k, new Set());
      numeric.get(k)!.add(v);
    }
  }
  const weightFields = [...numeric].filter(([, s]) => s.size >= rules.weightMinDistinct).map(([k]) => k);
  const first = rules.weightFirst;
  weightFields.sort((x, y) => (x === first ? -1 : y === first ? 1 : 0));
  return {
    unitTypeField: pickTypeField(unitRows, rules.typeFields),
    keypairTypeField: pickTypeField(edgeRows, rules.typeFields),
    timeFields: [...timeFields],
    weightFields,
    rules,
  };
}
