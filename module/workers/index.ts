// Runs the force layout, and distances and path sets, in web workers, or inline where there are
// no workers (unit tests).
import { loadGraph, pathSet, ringIndex, type Key } from '../core/index.ts';
import type { GraphWorker } from '../model/contracts.ts';
import { forceLayout, type ForceInput, type ForceOutput } from './force.ts';

let next = 0;
let layoutWorker: Worker | null = null;
const hasWorkers = typeof Worker !== 'undefined';

function ask<T>(worker: Worker, message: Record<string, unknown>): Promise<T> {
  const id = ++next;
  return new Promise((resolve) => {
    const listen = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', listen);
      resolve(e.data.out);
    };
    worker.addEventListener('message', listen);
    worker.postMessage({ ...message, id });
  });
}

/** The force layout in a worker, or on the page where there are no workers or `inline` asks for it. */
export function runForce(input: ForceInput, inline = false): Promise<ForceOutput> {
  if (!hasWorkers || inline) return Promise.resolve(forceLayout(input));
  layoutWorker ??= new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  return ask(layoutWorker, { input });
}

export type { ForceInput, ForceOutput };

/** A worker that keeps one graph and answers distances and path sets about it; on the page with `inline`. */
export function graphWorker(units: Key[], keypairs: [Key, Key][], inline = false): GraphWorker {
  if (!hasWorkers || inline) {
    const r = loadGraph({
      format: 'graphview-graph/1',
      vertices: units.map((key) => ({ key })),
      edges: keypairs.map(([f, t]) => ({ from: f, to: t })),
    });
    if (!r.ok) throw new Error('unreachable');
    return {
      distances: (root) => Promise.resolve(ringIndex(r.graph, root)),
      paths: (from, to, extra, limits) => Promise.resolve(pathSet(r.graph, from, to, extra, limits)),
      terminate() {},
    };
  }
  const w = new Worker(new URL('./graph.worker.ts', import.meta.url), { type: 'module' });
  const ready = ask<boolean>(w, { kind: 'graph', units, keypairs });
  return {
    distances: (root) => ready.then(() => ask<number[]>(w, { kind: 'distances', root })),
    paths: (from, to, extra, limits) => ready.then(() => ask(w, { kind: 'paths', from, to, extra, limits })),
    terminate: () => w.terminate(),
  };
}
