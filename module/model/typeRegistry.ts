// The types of units and keypairs (specification 6.6): found in the data, or given by the
// profile's classes and declared pairs; paired into complementary keypair types, labelled and
// coloured. People may rename and recolour them.
import { keyId, keypairId, tokens, type Graph, type Key, type Theme } from '../core/index.ts';
import { BACKWARD_TINT, MAX_TYPES, OTHER, TYPE_PALETTE } from '../settings/defaults.ts';
import type { TypeInfo, TypePair } from './contracts.ts';
import { PUBLIC_PROFILE, type Profile } from './profile.ts';
import { typeText, type Schema } from './schema.ts';

export { MAX_TYPES, OTHER, TYPE_PALETTE };

/** How types are coloured: the settings of the group "Types", for one theme (6.6). */
export interface TypeLook {
  palette: readonly string[];
  /** The colour of types past the palette, and of parts without a type. */
  other: string;
  surface: string;
  /** How far a complement's colour moves toward the surface. */
  tint: number;
  /** Palette slots in the shaders; the last one serves every further type. */
  slots: number;
}

/** The look of the defaults, for a theme. */
export const typeLook = (theme: Theme): TypeLook => ({
  palette: TYPE_PALETTE[theme],
  other: tokens[theme].context,
  surface: tokens[theme].surface,
  tint: BACKWARD_TINT,
  slots: MAX_TYPES,
});

/** Labels and colours a person set, by type id. */
export type Custom = Map<string, { label?: string; colour?: string }>;

export interface TypeRegistry {
  /** Unit types, most frequent first. */
  unit: TypeInfo[];
  /** Keypair types, pair by pair: forward then backward. */
  keypair: TypeInfo[];
  pairs: TypePair[];
  /** Each unit's type id, or null, in unit order. */
  unitOf: (string | null)[];
  /** The palette slot of each unit, in unit order. */
  unitSlot: Float32Array;
  /** The palette slot of each keypair, by keypair id. */
  keypairSlot: Map<string, number>;
  /** The slot of types past the palette, and of parts without a type. */
  other: number;
  /** The look the colours came from. */
  look: TypeLook;
}

export const EMPTY_TYPES: TypeRegistry = {
  unit: [],
  keypair: [],
  pairs: [],
  unitOf: [],
  unitSlot: new Float32Array(0),
  keypairSlot: new Map(),
  other: OTHER,
  look: typeLook('light'),
};

const hex = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

/** Mixes two colours given as #RRGGBB. */
export function mixColour(a: string, b: string, t: number): string {
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => hex(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join('')}`;
}

/** Types in order of frequency; ties keep their first appearance. */
function byFrequency(values: (string | null)[]): { id: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) if (v !== null) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([id, count]) => ({ id, count })).sort((x, y) => y.count - x.count);
}

/**
 * Pairs keypair types by how often the type of a keypair meets the type of its reverse: the most
 * frequent pair first; within a pair, the type met first in the file goes forward. A type whose
 * reverses carry the same type pairs with itself. A type left without a free partner stays alone,
 * after the pairs, the most frequent first.
 */
export function pairTypes(g: Graph, field: string | null): TypePair[] {
  if (!field) return [];
  const typeOf = (a: Key, b: Key) => typeText(g.keypairInfo.get(keypairId(a, b))?.attrs?.[field]);
  const firstSeen = new Map<string, number>();
  const meets = new Map<string, { t: string; u: string; n: number; first: number }>();
  g.keypairs.forEach(([a, b], i) => {
    const t = typeOf(a, b);
    if (t === null) return;
    if (!firstSeen.has(t)) firstSeen.set(t, i);
    const u = g.keypairInfo.has(keypairId(b, a)) ? typeOf(b, a) : null;
    if (u === null) return;
    // One entry per unordered pair of types; type values are text, so their order is only a name.
    const id = t < u ? `${t}\t${u}` : `${u}\t${t}`;
    const m = meets.get(id) ?? { t, u, n: 0, first: i };
    m.n++;
    meets.set(id, m);
  });
  const taken = new Set<string>();
  const pairs: TypePair[] = [];
  for (const { t, u } of [...meets.values()].sort((p, q) => q.n - p.n || p.first - q.first)) {
    if (taken.has(t) || taken.has(u)) continue;
    taken.add(t);
    taken.add(u);
    const [forward, backward] = firstSeen.get(t)! <= firstSeen.get(u)! ? [t, u] : [u, t];
    pairs.push({ forward, backward });
  }
  for (const { id } of byFrequency(g.keypairs.map(([a, b]) => typeOf(a, b))))
    if (!taken.has(id)) pairs.push({ forward: id, backward: null });
  return pairs;
}

/**
 * The declared pairs whose types the data holds, in their order, then the inferred pairs without
 * the declared types. A type whose partner was declared elsewhere stays alone.
 */
export function withDeclared(inferred: TypePair[], declared: [string, string][], present: Set<string>): TypePair[] {
  const taken = new Set<string>();
  const out: TypePair[] = [];
  for (const [forward, backward] of declared) {
    if (!present.has(forward) && !present.has(backward)) continue;
    out.push({ forward, backward: backward === forward ? null : backward });
    taken.add(forward).add(backward);
  }
  for (const p of inferred) {
    const left = [p.forward, p.backward].filter((t): t is string => t !== null && !taken.has(t));
    if (left.length === 2) out.push(p);
    else if (left.length === 1) out.push({ forward: left[0], backward: null });
    left.forEach((t) => taken.add(t));
  }
  return out;
}

/** Builds the registry of a graph's types, with colours from the look for the theme and any custom ones. */
export function buildTypes(
  g: Graph,
  schema: Schema,
  theme: Theme,
  custom: { unit: Custom; keypair: Custom },
  profile: Pick<Profile, 'classOf' | 'pairs'> = PUBLIC_PROFILE,
  look: TypeLook = typeLook(theme),
): TypeRegistry {
  const { palette, other: context, surface } = look;
  const last = look.slots - 1;
  const uf = schema.unitTypeField;
  const kf = schema.keypairTypeField;
  const { classOf } = profile;
  const unitTypes = g.units.map((k) => {
    const info = g.unitInfo.get(keyId(k));
    return classOf ? classOf(info, k) : uf ? typeText(info?.attrs?.[uf]) : null;
  });
  const info = (id: string, count: number, slot: number, colour: string, c: Custom): TypeInfo => ({
    id,
    count,
    slot,
    label: c.get(id)?.label ?? id,
    colour: c.get(id)?.colour ?? colour,
  });
  const unit = byFrequency(unitTypes).map(({ id, count }, i) =>
    info(id, count, Math.min(i, last), i < palette.length ? palette[i] : context, custom.unit),
  );
  const unitSlotOf = new Map(unit.map((t) => [t.id, t.slot]));
  const unitSlot = Float32Array.from(unitTypes, (t) => (t === null ? last : (unitSlotOf.get(t) ?? last)));

  const keypairTypes = g.keypairs.map(([a, b]) =>
    kf ? typeText(g.keypairInfo.get(keypairId(a, b))?.attrs?.[kf]) : null,
  );
  const present = new Set(keypairTypes.filter((t): t is string => t !== null));
  const pairs = withDeclared(pairTypes(g, kf), profile.pairs, present);
  const counts = new Map(byFrequency(keypairTypes).map((t) => [t.id, t.count]));
  const keypair: TypeInfo[] = [];
  pairs.forEach((p, i) => {
    const base = i < palette.length ? palette[i] : context;
    const slot = () => Math.min(keypair.length, last);
    keypair.push(info(p.forward, counts.get(p.forward) ?? 0, slot(), base, custom.keypair));
    if (p.backward !== null && p.backward !== p.forward) {
      // The complement's default follows its forward type's colour, the person's own one included.
      const tint = mixColour(custom.keypair.get(p.forward)?.colour ?? base, surface, look.tint);
      keypair.push(info(p.backward, counts.get(p.backward) ?? 0, slot(), tint, custom.keypair));
    }
  });
  const keypairSlotOf = new Map(keypair.map((t) => [t.id, t.slot]));
  const keypairSlot = new Map(
    g.keypairs.map(([a, b], i) => {
      const t = keypairTypes[i];
      return [keypairId(a, b), t === null ? last : (keypairSlotOf.get(t) ?? last)] as [string, number];
    }),
  );
  return { unit, keypair, pairs, unitOf: unitTypes, unitSlot, keypairSlot, other: last, look };
}

/** The palette a shader needs: one colour per slot, the colour past the palette elsewhere. */
export function paletteOf(types: TypeInfo[], look: TypeLook): string[] {
  const out = Array.from({ length: look.slots }, () => look.other);
  for (const t of types) if (t.slot < look.slots - 1) out[t.slot] = t.colour;
  return out;
}
