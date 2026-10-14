// The aids of specification Part C: counts, degrees, components and rings.
import { keyId, keypairId } from './keys.ts';
import type { Graph, Key } from './types.ts';

/** Unit positions and adjacency by index, built once per graph object. */
export interface Index {
  units: Key[];
  pos: Map<string, number>;
  /** Outgoing neighbours per unit, in keypair file order. */
  out: number[][];
  /** Incoming neighbours per unit, in keypair file order. */
  inc: number[][];
}

const cache = new WeakMap<Graph, Index>();

export function indexOf(graph: Graph): Index {
  let ix = cache.get(graph);
  if (ix) return ix;
  const pos = new Map<string, number>();
  graph.units.forEach((k, i) => pos.set(keyId(k), i));
  const out: number[][] = graph.units.map(() => []);
  const inc: number[][] = graph.units.map(() => []);
  for (const [a, b] of graph.keypairs) {
    const ia = pos.get(keyId(a));
    const ib = pos.get(keyId(b));
    if (ia === undefined || ib === undefined) continue;
    out[ia].push(ib);
    inc[ib].push(ia);
  }
  ix = { units: graph.units, pos, out, inc };
  cache.set(graph, ix);
  return ix;
}

/** Complete relations: unordered pairs of units whose two keypairs both exist. */
export function relationCount(graph: Graph): number {
  const ids = new Set(graph.keypairs.map(([a, b]) => keypairId(a, b)));
  let both = 0;
  for (const [a, b] of graph.keypairs) if (ids.has(keypairId(b, a))) both++;
  return both / 2;
}

/** Per unit, in unit order: distinct neighbours either way, and keypairs in each direction. */
export function degrees(graph: Graph): { key: Key; relations: number; outgoing: number; incoming: number }[] {
  const ix = indexOf(graph);
  return graph.units.map((key, i) => ({
    key,
    relations: new Set([...ix.out[i], ...ix.inc[i]]).size,
    outgoing: ix.out[i].length,
    incoming: ix.inc[i].length,
  }));
}

/** Parts of the graph ignoring direction, in the order of their first unit, units in file order. */
export function components(graph: Graph): { sizes: number[]; parts: Key[][] } {
  const ix = indexOf(graph);
  const part = new Array<number>(ix.units.length).fill(-1);
  const parts: Key[][] = [];
  for (let s = 0; s < ix.units.length; s++) {
    if (part[s] !== -1) continue;
    const p = parts.length;
    const members: number[] = [s];
    part[s] = p;
    for (let q = 0; q < members.length; q++) {
      const u = members[q];
      for (const v of [...ix.out[u], ...ix.inc[u]]) {
        if (part[v] === -1) {
          part[v] = p;
          members.push(v);
        }
      }
    }
    members.sort((x, y) => x - y);
    parts.push(members.map((i) => ix.units[i]));
  }
  return { sizes: parts.map((p) => p.length).sort((x, y) => y - x), parts };
}

/** Steps from the focus along keypairs in their direction, breadth first, outgoing keypairs in file order. */
export function ringIndex(graph: Graph, focus: Key): number[] {
  const ix = indexOf(graph);
  const dist = new Array<number>(ix.units.length).fill(-1);
  const start = ix.pos.get(keyId(focus));
  if (start === undefined) return dist;
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q];
    for (const v of ix.out[u]) {
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1;
        queue.push(v);
      }
    }
  }
  return dist;
}

/** Units grouped by steps from the focus; ring 0 holds the focus. Unreachable units go to beyond. */
export function rings(graph: Graph, focus: Key): { rings: Key[][]; beyond: Key[] } {
  const ix = indexOf(graph);
  const dist = ringIndex(graph, focus);
  const start = ix.pos.get(keyId(focus));
  if (start === undefined) return { rings: [], beyond: [...ix.units] };
  // Breadth-first order within each ring.
  const order = [start];
  const seen = new Set(order);
  for (let q = 0; q < order.length; q++) {
    for (const v of ix.out[order[q]]) {
      if (!seen.has(v)) {
        seen.add(v);
        order.push(v);
      }
    }
  }
  const result: Key[][] = [];
  for (const i of order) (result[dist[i]] ??= []).push(ix.units[i]);
  return { rings: result, beyond: ix.units.filter((_, i) => dist[i] === -1) };
}
