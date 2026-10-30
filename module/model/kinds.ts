// Kinds of unit: a unit is plain, or of a kind its profile names, such as the interface, which
// joins two units. A kind that joins finds each unit's ends: the units it shares a relation with.
// These checks are the model's own, so the core's issues, the fingerprint and the gates stay as
// they are.
import { keyId, type Graph, type Key, type UnitInfo } from '../core/index.ts';
import { PUBLIC_PROFILE, type KindRule, type Profile } from './profile.ts';
import type { Relation } from './topology.ts';

/** 'plain', or the id of a kind the profile names, such as 'interface'. */
export type Kind = string;

/** Issues of joining kinds: a unit that does not join exactly two units, two joining units related directly, and two plain units related directly where the profile forbids it. */
export type KindIssue =
  | { code: 'interface-ends'; key: Key; ends: number }
  | { code: 'interface-pair'; keypair: [Key, Key] }
  | { code: 'direct-relation'; keypair: [Key, Key] };

export interface Kinds {
  /** Each unit's kind, by unit index. */
  of: Kind[];
  /** The ends of each unit of a joining kind, by unit index, in the order of its relations. */
  ends: Map<number, number[]>;
  issues: KindIssue[];
}

export const NO_KINDS: Kinds = { of: [], ends: new Map(), issues: [] };

/** The first kind that claims the unit, or plain. */
export function kindOfUnit(info: UnitInfo | undefined, key: Key, rules: KindRule[] = PUBLIC_PROFILE.kinds): Kind {
  return rules.find((r) => r.claims(info, key))?.id ?? 'plain';
}

/**
 * The kinds of a graph, the ends of its joining units, and their issues: ends first, by unit, then
 * pairs, by relation, then direct relations, by relation. The profile's rules of 3.8 decide whether a
 * self-relation and a direct relation are issues.
 */
export function findKinds(
  g: Graph,
  relations: Relation[],
  rules: KindRule[] = PUBLIC_PROFILE.kinds,
  allow: Pick<Profile, 'selfRelations' | 'directRelations'> = {},
): Kinds {
  const of = g.units.map((k) => kindOfUnit(g.unitInfo.get(keyId(k)), k, rules));
  const joining = new Set(rules.filter((r) => r.joins).map((r) => r.id));
  const ends = new Map<number, number[]>();
  of.forEach((kind, i) => joining.has(kind) && ends.set(i, []));
  const pairs: KindIssue[] = [];
  const direct: KindIssue[] = [];
  const join = (i: number, j: number) => {
    const e = ends.get(i);
    if (e && !e.includes(j)) e.push(j);
  };
  for (const r of relations) {
    join(r.a, r.b);
    join(r.b, r.a);
    if (ends.has(r.a) && ends.has(r.b)) pairs.push({ code: 'interface-pair', keypair: [r.ka, r.kb] });
    else if (!ends.has(r.a) && !ends.has(r.b) && allow.directRelations === 'issue')
      direct.push({ code: 'direct-relation', keypair: [r.ka, r.kb] });
  }
  // A self-relation: one end, joined both ways.
  const both = (i: number, j: number) =>
    relations.some((r) => ((r.a === i && r.b === j) || (r.a === j && r.b === i)) && r.ab && r.ba);
  const issues: KindIssue[] = [];
  for (const [i, e] of ends) {
    if (e.length === 2) continue;
    if (e.length === 1 && allow.selfRelations === 'allowed' && both(i, e[0])) continue;
    issues.push({ code: 'interface-ends', key: g.units[i], ends: e.length });
  }
  return { of, ends, issues: [...issues, ...pairs, ...direct] };
}
