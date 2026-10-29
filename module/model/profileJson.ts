// A profile from JSON (specification 5.7 and 3.9): kinds by an attribute, classes, class units, member
// pairs and their perspectives, pair types, superseding by pair type, and the two rules of 3.8.
import { keyId, keypairId, type Graph, type Key, type KeypairInfo, type UnitInfo } from '../core/index.ts';
import type { ProfileJson } from '../settings/profileJson.ts';
import type { Perspective } from './contracts.ts';
import { INTERFACE, type KindRule, type Profile } from './profile.ts';
import { typeText } from './schema.ts';

export type { KindJson, ProfileJson } from '../settings/profileJson.ts';

/** A row's field: the interface mark, or an attribute. */
const fieldOf = (info: UnitInfo | undefined, field: string): unknown =>
  field === 'interface' ? info?.interface : info?.attrs?.[field];

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function profileFromJson(json: ProfileJson): Profile {
  const field = {
    class: json.classField ?? 'class',
    classUnit: json.classUnitField ?? 'classUnit',
    pair: json.pairField ?? 'pair',
    pairType: json.pairTypeField ?? 'pairType',
  };
  const kinds: KindRule[] = json.kinds
    ? json.kinds.map((k) => ({
        id: k.id,
        joins: k.joins,
        claims: (info) => sameJson(fieldOf(info, k.field), k.equals),
      }))
    : [INTERFACE];
  const joining = kinds.filter((k) => k.joins);
  const joins = (info: UnitInfo | undefined, key: Key) => joining.some((k) => k.claims(info, key));

  /** An interface's member pair as its row holds it, or null. */
  const pairOf = (info: UnitInfo | undefined): { type: string | null; perspectives: Perspective[] } | null => {
    const p = info?.attrs?.[field.pair] as { type?: unknown; perspectives?: unknown } | undefined;
    if (!p || typeof p !== 'object') return null;
    const perspectives = Array.isArray(p.perspectives)
      ? p.perspectives.flatMap((x: { type?: unknown; from?: unknown; to?: unknown }) =>
          x &&
          (typeof x.from === 'string' || typeof x.from === 'number') &&
          (typeof x.to === 'string' || typeof x.to === 'number')
            ? [{ from: x.from, to: x.to, type: typeText(x.type) }]
            : [],
        )
      : [];
    return { type: typeText(p.type), perspectives };
  };
  const pairTypeOf = (info: KeypairInfo | undefined) => typeText(info?.attrs?.[field.pairType]);

  /** The perspective from one end through the interface: from its member pair, else the pair type of (from, interface). */
  const perspective = (g: Graph, iface: Key, from: Key, to: Key): string | null => {
    const pair = pairOf(g.unitInfo.get(keyId(iface)));
    const found = pair?.perspectives.find((p) => keyId(p.from) === keyId(from) && keyId(p.to) === keyId(to));
    return found?.type ?? pairTypeOf(g.keypairInfo.get(keypairId(from, iface)));
  };

  // The units each graph's superseding perspectives start at, found once per graph.
  const gone = new WeakMap<Graph, Set<string>>();
  const supersededIn = (g: Graph): Set<string> => {
    let out = gone.get(g);
    if (out) return out;
    out = new Set();
    const types = new Set(json.supersededBy ?? []);
    for (const k of g.units) {
      for (const p of pairOf(g.unitInfo.get(keyId(k)))?.perspectives ?? [])
        if (p.type !== null && types.has(p.type)) out.add(keyId(p.from));
    }
    for (const [a, b] of g.keypairs) {
      const t = pairTypeOf(g.keypairInfo.get(keypairId(a, b)));
      if (t !== null && types.has(t) && !joins(g.unitInfo.get(keyId(a)), a) && joins(g.unitInfo.get(keyId(b)), b))
        out.add(keyId(a));
    }
    gone.set(g, out);
    return out;
  };

  return {
    kinds,
    classOf: (info) => typeText(info?.attrs?.[field.class]),
    classUnit: (info) => info?.attrs?.[field.classUnit] === true,
    pairOf,
    pairTypeOf,
    pairs: json.pairs ?? [],
    checks: [],
    ...(json.supersededBy?.length ? { superseded: (g: Graph, key: Key) => supersededIn(g).has(keyId(key)) } : {}),
    perspective,
    selfRelations: json.selfRelations ?? 'issue',
    directRelations: json.directRelations ?? 'allowed',
  };
}
