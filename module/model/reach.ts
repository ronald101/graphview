// Steps between units over the relations, either way (specification 6.20 and 6.21): the neighbours of
// a selection, the neighbourhood of a scope, and the relations that leave a scope.
import type { Relation } from './topology.ts';

/** Each unit's neighbours over the relations, by index. */
export function adjacency(n: number, relations: readonly Relation[]): number[][] {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const r of relations) {
    if (r.a === r.b) continue;
    out[r.a].push(r.b);
    out[r.b].push(r.a);
  }
  return out;
}

/** Each unit's steps from the given units, up to `hops`; -1 beyond. */
export function stepsFrom(adj: readonly number[][], from: readonly number[], hops: number): Int32Array {
  const steps = new Int32Array(adj.length).fill(-1);
  let ring = [...new Set(from)];
  for (const i of ring) steps[i] = 0;
  for (let d = 1; d <= hops && ring.length; d++) {
    const next: number[] = [];
    for (const i of ring)
      for (const j of adj[i])
        if (steps[j] < 0) {
          steps[j] = d;
          next.push(j);
        }
    ring = next;
  }
  return steps;
}

/**
 * The given units and those within `hops` steps of them, up to `limit`: nearer units first, then those
 * with more relations, then file order. The given units come first and always count.
 */
export function neighbourhood(
  adj: readonly number[][],
  from: readonly number[],
  hops: number,
  limit: number,
): number[] {
  const steps = stepsFrom(adj, from, hops);
  const centres = [...new Set(from)];
  const rest: number[] = [];
  steps.forEach((d, i) => d > 0 && rest.push(i));
  rest.sort((p, q) => steps[p] - steps[q] || adj[q].length - adj[p].length || p - q);
  return [...centres, ...rest.slice(0, Math.max(0, limit - centres.length))];
}

/** Each unit's number of relations to units outside the scope; 0 for units outside it. */
export function outsideCounts(adj: readonly number[][], inScope: Uint8Array): Uint32Array {
  return Uint32Array.from(adj, (near, i) => (inScope[i] ? near.filter((j) => !inScope[j]).length : 0));
}
