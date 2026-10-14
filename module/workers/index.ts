// Runs layouts and path sets in web workers, or inline where there are no workers (unit tests).
import { loadGraph, pathSet, type Key, type PathLimits, type PathSetResult } from '../core/index.ts';
import { forceLayout, type ForceInput, type ForceOutput } from './force.ts';

let next = 0;
let layoutWorker: Worker | null = null;
let pathWorker: Worker | null = null;
const hasWorkers = typeof Worker !== 'undefined';

function ask<T>(worker: Worker, message: Record<string, unknown>): Promise<T> {
  const id = ++next;
  return new Promise((resolve) => {
    const listen = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', listen);
      resolve(e.data.out ?? e.data.result);
    };
    worker.addEventListener('message', listen);
    worker.postMessage({ ...message, id });
  });
}

export function runForce(input: ForceInput): Promise<ForceOutput> {
  if (!hasWorkers) return Promise.resolve(forceLayout(input));
  layoutWorker ??= new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  return ask(layoutWorker, { input });
}

/** Path sets in a worker. A new request replaces the worker, so that a long count never blocks the next. */
export function runPathSet(
  units: Key[],
  keypairs: [Key, Key][],
  from: Key,
  to: Key,
  extra: number,
  limits: PathLimits,
): Promise<PathSetResult> {
  if (!hasWorkers) {
    const r = loadGraph({
      format: 'graphview-graph/1',
      vertices: units.map((key) => ({ key })),
      edges: keypairs.map(([f, t]) => ({ from: f, to: t })),
    });
    if (!r.ok) throw new Error('unreachable');
    return Promise.resolve(pathSet(r.graph, from, to, extra, limits));
  }
  pathWorker ??= new Worker(new URL('./pathset.worker.ts', import.meta.url), { type: 'module' });
  return ask(pathWorker, { units, keypairs, from, to, extra, limits });
}

export type { ForceInput, ForceOutput };
