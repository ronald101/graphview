// Graph generators (specification G3). Every graph obeys rules 1 to 4: keys 1 to n,
// both keypairs of every relation, no unit without a relation, rows in key order.
import { mulberry32, type Rng } from './random.ts';

export const GENERATOR = 'graphview-gen/1';
export const MAX_UNITS = 20000;

export type Family =
  | 'path'
  | 'cycle'
  | 'star'
  | 'complete'
  | 'grid'
  | 'tree'
  | 'components'
  | 'random-size'
  | 'random-degrees'
  | 'small-world'
  | 'preferential'
  | 'communities';

export type Params = Record<string, number | number[]>;

export interface GraphDoc {
  format: 'graphview-graph/1';
  meta: Record<string, unknown>;
  vertices: { key: number }[];
  edges: { from: number; to: number }[];
}

export interface Generated {
  doc: GraphDoc;
  /** Random by degrees only: the degrees reached, next to the ones asked. */
  reached?: number[];
}

export const FAMILIES: { id: Family; name: string; params: Record<string, number | number[]> }[] = [
  { id: 'path', name: 'Path', params: { n: 8 } },
  { id: 'cycle', name: 'Cycle', params: { n: 8 } },
  { id: 'star', name: 'Star', params: { n: 8 } },
  { id: 'complete', name: 'Complete', params: { n: 6 } },
  { id: 'grid', name: 'Grid', params: { rows: 4, columns: 5 } },
  { id: 'tree', name: 'Tree', params: { n: 15, b: 2 } },
  { id: 'components', name: 'Separate components', params: { c: 3, k: 4 } },
  { id: 'random-size', name: 'Random by size', params: { n: 30, m: 40, c: 2 } },
  { id: 'random-degrees', name: 'Random by degrees', params: { degrees: [3, 3, 2, 2, 2, 1, 1] } },
  { id: 'small-world', name: 'Small world', params: { n: 30, k: 4, beta: 0.1 } },
  { id: 'preferential', name: 'Preferential growth', params: { n: 40, m0: 2 } },
  { id: 'communities', name: 'Communities', params: { n: 40, g: 4, pIn: 0.3, pOut: 0.02 } },
];

/** A set of relations between units 1..n, kept as unordered pairs. */
class Relations {
  readonly n: number;
  private readonly adj: Set<number>[];
  count = 0;
  constructor(n: number) {
    this.n = n;
    this.adj = Array.from({ length: n + 1 }, () => new Set<number>());
  }
  has(a: number, b: number) {
    return this.adj[a].has(b);
  }
  add(a: number, b: number) {
    if (a === b || this.has(a, b)) return false;
    this.adj[a].add(b);
    this.adj[b].add(a);
    this.count++;
    return true;
  }
  remove(a: number, b: number) {
    if (this.adj[a].delete(b)) {
      this.adj[b].delete(a);
      this.count--;
    }
  }
  degree(a: number) {
    return this.adj[a].size;
  }
  /** Both keypairs of every relation, in key order. */
  edges() {
    const out: { from: number; to: number }[] = [];
    for (let a = 1; a <= this.n; a++) {
      for (const b of [...this.adj[a]].sort((x, y) => x - y)) out.push({ from: a, to: b });
    }
    return out;
  }
}

function need(ok: boolean, message: string): void {
  if (!ok) throw new RangeError(message);
}
const whole = (v: unknown, name: string): number => {
  need(typeof v === 'number' && Number.isInteger(v), `${name} must be a whole number`);
  return v as number;
};
const fraction = (v: unknown, name: string): number => {
  need(typeof v === 'number' && v >= 0 && v <= 1, `${name} must lie between 0 and 1`);
  return v as number;
};
const units = (n: number) => {
  need(n <= MAX_UNITS, `at most ${MAX_UNITS} units`);
  return new Relations(n);
};

/** Splits units 1..n over c parts as evenly as possible, as contiguous key ranges. */
function split(n: number, c: number): number[][] {
  const parts: number[][] = [];
  let next = 1;
  for (let p = 0; p < c; p++) {
    const size = Math.floor(n / c) + (p < n % c ? 1 : 0);
    parts.push(Array.from({ length: size }, () => next++));
  }
  return parts;
}

/** A random spanning tree over the given units. */
function spanningTree(r: Relations, part: number[], rng: Rng) {
  const order = rng.shuffle([...part]);
  for (let i = 1; i < order.length; i++) r.add(order[i], order[rng.below(i)]);
}

function build(family: Family, p: Params, rng: Rng): { r: Relations; reached?: number[] } {
  switch (family) {
    case 'path': {
      const n = whole(p.n, 'n');
      need(n >= 2, 'n must be at least 2');
      const r = units(n);
      for (let i = 1; i < n; i++) r.add(i, i + 1);
      return { r };
    }
    case 'cycle': {
      const n = whole(p.n, 'n');
      need(n >= 3, 'n must be at least 3');
      const r = units(n);
      for (let i = 1; i <= n; i++) r.add(i, (i % n) + 1);
      return { r };
    }
    case 'star': {
      const n = whole(p.n, 'n');
      need(n >= 2, 'n must be at least 2');
      const r = units(n);
      for (let i = 2; i <= n; i++) r.add(1, i);
      return { r };
    }
    case 'complete': {
      const n = whole(p.n, 'n');
      need(n >= 2 && n <= 200, 'n must lie between 2 and 200');
      const r = units(n);
      for (let a = 1; a <= n; a++) for (let b = a + 1; b <= n; b++) r.add(a, b);
      return { r };
    }
    case 'grid': {
      const rows = whole(p.rows, 'rows');
      const cols = whole(p.columns, 'columns');
      need(rows >= 1 && cols >= 1 && rows * cols >= 2, 'rows and columns at least 1, and at least 2 units');
      const r = units(rows * cols);
      const at = (i: number, j: number) => i * cols + j + 1;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (j + 1 < cols) r.add(at(i, j), at(i, j + 1));
          if (i + 1 < rows) r.add(at(i, j), at(i + 1, j));
        }
      }
      return { r };
    }
    case 'tree': {
      const n = whole(p.n, 'n');
      const b = whole(p.b, 'b');
      need(n >= 2 && b >= 1, 'n at least 2 and b at least 1');
      const r = units(n);
      for (let i = 2; i <= n; i++) r.add(Math.floor((i - 2) / b) + 1, i);
      return { r };
    }
    case 'components': {
      const c = whole(p.c, 'c');
      const k = whole(p.k, 'k');
      need(c >= 1 && k >= 2, 'c at least 1 and k at least 2');
      const r = units(c * k);
      for (let part = 0; part < c; part++) for (let i = 1; i < k; i++) r.add(part * k + i, part * k + i + 1);
      return { r };
    }
    case 'random-size': {
      const n = whole(p.n, 'n');
      const m = whole(p.m, 'm');
      const c = whole(p.c, 'c');
      need(c >= 1 && n >= 2 * c, 'parts c at least 1, and n at least 2c');
      const parts = split(n, c);
      const most = parts.reduce((s, part) => s + (part.length * (part.length - 1)) / 2, 0);
      need(m >= n - c && m <= most, `m must lie between ${n - c} and ${most}`);
      const r = units(n);
      for (const part of parts) spanningTree(r, part, rng);
      if (m - r.count > (most - r.count) / 2) {
        // Dense: list every free pair and take a random selection.
        const free: [number, number][] = [];
        for (const part of parts) {
          for (let i = 0; i < part.length; i++) {
            for (let j = i + 1; j < part.length; j++) if (!r.has(part[i], part[j])) free.push([part[i], part[j]]);
          }
        }
        rng.shuffle(free);
        for (let i = 0; r.count < m; i++) r.add(free[i][0], free[i][1]);
      } else {
        // Sparse: draw a part by its capacity, then a pair inside it.
        const weights = parts.map((part) => (part.length * (part.length - 1)) / 2);
        while (r.count < m) {
          let x = rng.next() * most;
          let q = 0;
          while (x >= weights[q] && q < parts.length - 1) x -= weights[q++];
          const part = parts[q];
          r.add(part[rng.below(part.length)], part[rng.below(part.length)]);
        }
      }
      return { r };
    }
    case 'random-degrees': {
      const asked = p.degrees;
      need(Array.isArray(asked) && asked.length >= 2, 'a list of at least 2 degrees');
      const list = (asked as number[]).map((d, i) => whole(d, `degree ${i + 1}`));
      need(
        list.every((d) => d >= 0),
        'degrees must not be negative',
      );
      const n = list.length;
      const r = units(n);
      const stubs: number[] = [];
      list.forEach((d, i) => {
        for (let s = 0; s < d; s++) stubs.push(i + 1);
      });
      rng.shuffle(stubs);
      // Pair stubs in order; loops and repeats are dropped, and an odd last stub stays unused.
      for (let i = 0; i + 1 < stubs.length; i += 2) r.add(stubs[i], stubs[i + 1]);
      for (let a = 1; a <= n; a++) {
        if (r.degree(a) > 0) continue;
        let b = 1 + rng.below(n - 1);
        if (b >= a) b++;
        r.add(a, b);
      }
      const reached = Array.from({ length: n }, (_, i) => r.degree(i + 1));
      return { r, reached };
    }
    case 'small-world': {
      const n = whole(p.n, 'n');
      const k = whole(p.k, 'k');
      const beta = fraction(p.beta, 'beta');
      need(k >= 2 && k % 2 === 0, 'k must be even and at least 2');
      need(n > k, 'n must be larger than k');
      const r = units(n);
      for (let i = 1; i <= n; i++) for (let j = 1; j <= k / 2; j++) r.add(i, ((i - 1 + j) % n) + 1);
      // Watts–Strogatz: each unit rewires its forward relations; a rewire never makes a loop or a repeat.
      for (let j = 1; j <= k / 2; j++) {
        for (let i = 1; i <= n; i++) {
          if (rng.next() >= beta) continue;
          const old = ((i - 1 + j) % n) + 1;
          if (!r.has(i, old) || r.degree(i) >= n - 1) continue;
          let w = 1 + rng.below(n);
          while (w === i || r.has(i, w)) w = 1 + rng.below(n);
          r.remove(i, old);
          r.add(i, w);
          if (r.degree(old) === 0) {
            // Keep rule 4: undo a rewire that would leave a unit alone.
            r.remove(i, w);
            r.add(i, old);
          }
        }
      }
      return { r };
    }
    case 'preferential': {
      const n = whole(p.n, 'n');
      const m0 = whole(p.m0, 'm0');
      need(m0 >= 1 && n >= m0 + 1, 'm0 at least 1, and n at least m0 + 1');
      const r = units(n);
      // Start from a complete graph of m0 + 1 units; each new unit joins m0 existing ones.
      const ends: number[] = [];
      for (let a = 1; a <= m0 + 1; a++) {
        for (let b = a + 1; b <= m0 + 1; b++) {
          r.add(a, b);
          ends.push(a, b);
        }
      }
      for (let u = m0 + 2; u <= n; u++) {
        const chosen = new Set<number>();
        while (chosen.size < m0) chosen.add(ends[rng.below(ends.length)]);
        for (const v of chosen) {
          r.add(u, v);
          ends.push(u, v);
        }
      }
      return { r };
    }
    case 'communities': {
      const n = whole(p.n, 'n');
      const g = whole(p.g, 'g');
      const pIn = fraction(p.pIn, 'p-in');
      const pOut = fraction(p.pOut, 'p-out');
      need(g >= 1 && n >= 2 * g, 'groups g at least 1, and n at least 2g');
      need(n <= 5000, 'at most 5000 units for communities');
      const r = units(n);
      const groups = split(n, g);
      const groupOf = new Array<number>(n + 1);
      groups.forEach((members, q) => members.forEach((u) => (groupOf[u] = q)));
      for (let a = 1; a <= n; a++) {
        for (let b = a + 1; b <= n; b++) if (rng.next() < (groupOf[a] === groupOf[b] ? pIn : pOut)) r.add(a, b);
      }
      for (let a = 1; a <= n; a++) {
        if (r.degree(a) > 0) continue;
        const members = groups[groupOf[a]].filter((u) => u !== a);
        r.add(a, members[rng.below(members.length)]);
      }
      return { r };
    }
  }
}

/** Makes a graph from a family, its parameters and a seed. The same input gives the same graph. */
export function generate(family: Family, params: Params, seed: number): Generated {
  const info = FAMILIES.find((f) => f.id === family);
  need(info !== undefined, `unknown family ${family}`);
  need(Number.isInteger(seed), 'the seed must be a whole number');
  const { r, reached } = build(family, params, mulberry32(seed));
  const doc: GraphDoc = {
    format: 'graphview-graph/1',
    meta: { name: `${info!.name}, ${r.n} units`, generator: GENERATOR, family, params, seed },
    vertices: Array.from({ length: r.n }, (_, i) => ({ key: i + 1 })),
    edges: r.edges(),
  };
  return reached ? { doc, reached } : { doc };
}
