// Path sets (specification 4.5).
import { indexOf } from './aids.ts';
import { keyId } from './keys.ts';
import type { Graph, Key, PathLimits, PathSetLength, PathSetResult } from './types.ts';

export const PATH_DEFAULTS = { count: 10000, list: 200, timeMs: 2000, maxExtra: 20 } as const;

/** Simple paths from one unit to another, lengths d to d + extra, stopping at the limits. */
export function pathSet(graph: Graph, from: Key, to: Key, extra: number, limits: PathLimits = {}): PathSetResult {
  const n = Math.min(PATH_DEFAULTS.maxExtra, Math.max(0, Math.floor(extra)));
  const countLimit = limits.count ?? PATH_DEFAULTS.count;
  const listLimit = limits.list ?? PATH_DEFAULTS.list;
  const timeMs = limits.timeMs ?? PATH_DEFAULTS.timeMs;
  const result: PathSetResult = {
    from,
    to,
    extra: n,
    shortest: null,
    reason: null,
    lengths: [],
    total: 0,
    stopped: false,
    stoppedBy: null,
  };
  if (keyId(from) === keyId(to)) return { ...result, reason: 'same-unit' };

  const ix = indexOf(graph);
  const s = ix.pos.get(keyId(from));
  const t = ix.pos.get(keyId(to));
  if (s === undefined || t === undefined) return { ...result, reason: 'unreachable' };

  // Steps from every unit to the target, along keypairs in their direction.
  const toT = new Array<number>(ix.units.length).fill(-1);
  toT[t] = 0;
  const queue = [t];
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q];
    for (const v of ix.inc[u]) {
      if (toT[v] === -1) {
        toT[v] = toT[u] + 1;
        queue.push(v);
      }
    }
  }
  if (toT[s] === -1) return { ...result, reason: 'unreachable' };
  const d = toT[s];
  result.shortest = d;

  const deadline = Date.now() + timeMs;
  const onPath = new Uint8Array(ix.units.length);
  const path: number[] = [s];
  let visits = 0;
  let total = 0;
  let stoppedBy: 'count' | 'time' | null = null;

  for (let L = d; L <= d + n; L++) {
    const entry: PathSetLength = { length: L, count: 0, exact: true, paths: [] };
    const dfs = (u: number, left: number): void => {
      if (left === 0) {
        if (u !== t) return;
        entry.count++;
        total++;
        if (entry.paths.length < listLimit) entry.paths.push(path.map((i) => ix.units[i]));
        if (total >= countLimit) stoppedBy = 'count';
        return;
      }
      if (u === t) return;
      if ((++visits & 1023) === 0 && Date.now() > deadline) {
        stoppedBy = 'time';
        return;
      }
      for (const v of ix.out[u]) {
        if (onPath[v] || toT[v] === -1 || toT[v] > left - 1) continue;
        onPath[v] = 1;
        path.push(v);
        dfs(v, left - 1);
        path.pop();
        onPath[v] = 0;
        if (stoppedBy) return;
      }
    };
    onPath[s] = 1;
    dfs(s, L);
    onPath[s] = 0;
    if (stoppedBy) entry.exact = false;
    result.lengths.push(entry);
    if (stoppedBy) break;
  }
  result.total = total;
  result.stopped = stoppedBy !== null;
  result.stoppedBy = stoppedBy;
  return result;
}
