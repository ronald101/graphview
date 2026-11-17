// The force layout: ForceAtlas2 from seeded starting positions, run until it settles (specification 6.1).
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

/** The force layout's settings (the group "Layout"); the defaults give the layout of specification 6.1. */
export interface ForceSettings {
  /** Iterations between two checks for a settled layout. */
  batch: number;
  /** The layout settles when the mean step per iteration falls below this share of its size. */
  tolerance: number;
  maxIterations: number;
  /** Above this many units the Barnes–Hut approximation is used. */
  barnesHutFrom: number;
  barnesHutTheta: number;
  /** Above `from` units, these replace maxIterations and barnesHutTheta. */
  large: { from: number; maxIterations: number; barnesHutTheta: number };
  gravity: number;
  strongGravityMode: boolean;
  scalingRatio: number;
  /** Null for one plus the natural log of the units. */
  slowDown: number | null;
  linLogMode: boolean;
  outboundAttractionDistribution: boolean;
  adjustSizes: boolean;
  edgeWeightInfluence: number;
}

export const FORCE_DEFAULTS: ForceSettings = {
  batch: 25,
  tolerance: 2e-4,
  maxIterations: 1500,
  barnesHutFrom: 500,
  barnesHutTheta: 0.5,
  // A coarser Barnes–Hut grid for large graphs: about a third of the time per iteration (specification 6.1).
  large: { from: 2000, maxIterations: 300, barnesHutTheta: 1 },
  gravity: 0.05,
  strongGravityMode: true,
  scalingRatio: 10,
  slowDown: null,
  linLogMode: false,
  outboundAttractionDistribution: false,
  adjustSizes: false,
  edgeWeightInfluence: 1,
};

export interface ForceInput {
  units: string[];
  /** Relations as pairs of unit indexes, each once. */
  links: [number, number][];
  start: { x: number; y: number }[];
  /** Indexes of pinned units, which never move. */
  pinned: number[];
  settings: Partial<ForceSettings>;
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
  const f = { ...FORCE_DEFAULTS, ...input.settings };
  const large = n > f.large.from;
  const settings = {
    linLogMode: f.linLogMode,
    outboundAttractionDistribution: f.outboundAttractionDistribution,
    adjustSizes: f.adjustSizes,
    edgeWeightInfluence: f.edgeWeightInfluence,
    scalingRatio: f.scalingRatio,
    strongGravityMode: f.strongGravityMode,
    gravity: f.gravity,
    slowDown: f.slowDown ?? 1 + Math.log(n),
    barnesHutOptimize: n > f.barnesHutFrom,
    barnesHutTheta: large ? f.large.barnesHutTheta : f.barnesHutTheta,
  };
  const maxIterations = large ? f.large.maxIterations : f.maxIterations;
  const batch = Math.max(1, f.batch);
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
    if (move / Math.max(1, n) / batch < size * f.tolerance) break;
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
