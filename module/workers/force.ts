// The force layout: ForceAtlas2 from seeded starting positions, run until it settles (specification 6.1).
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

export interface ForceInput {
  units: string[];
  /** Relations as pairs of unit indexes, each once. */
  links: [number, number][];
  start: { x: number; y: number }[];
  /** Indexes of pinned units, which never move. */
  pinned: number[];
  settings: Record<string, number | string | boolean>;
}

export interface ForceOutput {
  positions: { x: number; y: number }[];
  iterations: number;
}

/** Runs ForceAtlas2 in batches until the mean step falls below a share of the extent. Deterministic. */
export function forceLayout(input: ForceInput): ForceOutput {
  const g = new Graph({ type: 'undirected' });
  input.units.forEach((id, i) => {
    g.addNode(id, { x: input.start[i].x, y: input.start[i].y, fixed: false });
  });
  for (const i of input.pinned) g.setNodeAttribute(input.units[i], 'fixed', true);
  for (const [a, b] of input.links) {
    const ia = input.units[a];
    const ib = input.units[b];
    if (!g.hasEdge(ia, ib)) g.addEdge(ia, ib);
  }
  const n = input.units.length;
  const settings = {
    ...forceAtlas2.inferSettings(g),
    barnesHutOptimize: n > 500,
    // A coarser Barnes–Hut grid for large graphs: about a third of the time per iteration (specification 6.1).
    ...(n > 2000 ? { barnesHutTheta: 1 } : {}),
    ...pick(input.settings, [
      'gravity',
      'scalingRatio',
      'slowDown',
      'strongGravityMode',
      'linLogMode',
      'barnesHutTheta',
    ]),
  };
  const maxIterations = Number(input.settings.maxIterations ?? (n > 2000 ? 300 : 1500));
  const batch = 25;
  let iterations = 0;
  let prev = snapshot(g, input.units);
  while (iterations < maxIterations) {
    forceAtlas2.assign(g, { iterations: batch, settings });
    iterations += batch;
    const next = snapshot(g, input.units);
    let move = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      move += Math.hypot(next[i].x - prev[i].x, next[i].y - prev[i].y);
      minX = Math.min(minX, next[i].x);
      maxX = Math.max(maxX, next[i].x);
      minY = Math.min(minY, next[i].y);
      maxY = Math.max(maxY, next[i].y);
    }
    prev = next;
    const size = Math.max(maxX - minX, maxY - minY, 1e-9);
    if (move / Math.max(1, n) / batch < size * 2e-4) break;
  }
  // ForceAtlas2 keeps positions as 32-bit floats; pinned units keep their exact places.
  for (const i of input.pinned) prev[i] = { ...input.start[i] };
  return { positions: prev, iterations };
}

function snapshot(g: Graph, units: string[]) {
  return units.map((id) => {
    const a = g.getNodeAttributes(id);
    return { x: a.x as number, y: a.y as number };
  });
}

function pick(o: Record<string, unknown>, keys: string[]): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const k of keys) if (typeof o[k] === 'number' || typeof o[k] === 'boolean') out[k] = o[k] as number | boolean;
  return out;
}
