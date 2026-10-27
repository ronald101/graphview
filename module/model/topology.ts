// Relations and chevrons (specification 6.2): the keypairs (a, b) and (b, a) become one relation,
// drawn as one line, and each keypair is one chevron on it.
import { keyId, keypairId, type Graph, type Key } from '../core/index.ts';

/** Two keypairs of a relation, consolidated into one line. */
export interface Relation {
  a: number;
  b: number;
  ka: Key;
  kb: Key;
  /** Whether the keypair (a, b) exists, and its reverse (b, a). */
  ab: boolean;
  ba: boolean;
}

/** One chevron per keypair: forward is (a, b), a third of the way from a; backward is (b, a). */
export interface Chevron {
  rel: number;
  forward: boolean;
}

export interface Topology {
  relations: Relation[];
  /** Each keypair's relation, by keypair id. */
  relationOf: Map<string, number>;
  chevrons: Chevron[];
}

export const noTopology = (): Topology => ({ relations: [], relationOf: new Map(), chevrons: [] });

/** Bidirectional consolidation: the keypairs (a, b) and (b, a) become one relation, one line. */
export function consolidate(g: Graph, index: Map<string, number>): Topology {
  const relations: Relation[] = [];
  const relationOf = new Map<string, number>();
  for (const [a, b] of g.keypairs) {
    if (relationOf.has(keypairId(a, b))) continue;
    const i = relations.length;
    relations.push({
      a: index.get(keyId(a))!,
      b: index.get(keyId(b))!,
      ka: a,
      kb: b,
      ab: true,
      ba: g.keypairInfo.has(keypairId(b, a)),
    });
    relationOf.set(keypairId(a, b), i);
    relationOf.set(keypairId(b, a), i);
  }
  const chevrons: Chevron[] = [];
  relations.forEach((r, i) => {
    if (r.ab) chevrons.push({ rel: i, forward: true });
    if (r.ba) chevrons.push({ rel: i, forward: false });
  });
  return { relations, relationOf, chevrons };
}
