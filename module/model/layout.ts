// Where units start (specification 6.1): given positions, or seeded starting
// positions for the force layout. Graph coordinates, y pointing down.
import { keyId, type Graph, type Key } from '../core/index.ts';
import { STEP } from '../settings/defaults.ts';

export { STEP };

export type Positions = Map<string, { x: number; y: number }>;

/** Seeded random numbers (mulberry32), for starting positions and offsets. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Given positions, for a graph whose every unit has one. */
export function givenLayout(graph: Graph): Positions {
  return new Map(
    graph.units.map((k) => {
      const p = graph.unitInfo.get(keyId(k))!.pos!;
      return [keyId(k), { x: p.x, y: p.y }];
    }),
  );
}

/** Seeded starting positions for the force layout, in a square that grows with the graph. */
export function startPositions(units: Key[], seed: number, step = STEP): Positions {
  const rnd = seeded(seed);
  const side = Math.sqrt(units.length) * step;
  return new Map(units.map((k) => [keyId(k), { x: rnd() * side, y: rnd() * side }]));
}
