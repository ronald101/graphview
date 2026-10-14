// Defaults of the view state and the look (specification D3 and D5), and how partial values merge.
import { PATH_DEFAULTS } from '../core/index.ts';
import type { DeepPartial, Look, ViewState } from '../types.ts';

export function defaultViewState(): ViewState {
  return {
    format: 'graphview-view/1',
    graph: null,
    focus: null,
    radius: null,
    beyond: 'fade',
    selection: { units: [], keypairs: [] },
    camera: { x: 0, y: 0, zoom: 1, angle: 0 },
    layout: { name: 'force', seed: 1, settings: {}, pinned: [] },
    paths: { ends: null, extra: 2, lit: null, showAll: null },
    filters: { hideLoneUnits: false },
    overlays: [],
    frame: null,
  };
}

export const DEFAULT_FONT = "'Atkinson Hyperlegible Next', system-ui, sans-serif";

export function defaultLook(): Look {
  return {
    theme: 'system',
    tokens: {},
    font: DEFAULT_FONT,
    labels: { field: 'label', show: 'auto' },
    relations: { draw: 'halves', icons: 'by-zoom', colour: 'around-selection' },
    superseded: 'fade',
    gestures: { pan: true, zoom: true, rotate: true, dragUnits: true, keyboard: true },
    motion: 'system',
    panels: { details: true, paths: true, issues: true, key: true },
    limits: {
      pathCount: PATH_DEFAULTS.count,
      pathList: PATH_DEFAULTS.list,
      pathTimeMs: PATH_DEFAULTS.timeMs,
      maxExtra: 20,
    },
  };
}

const plain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** Merges a partial value into a whole one: objects merge field by field, everything else replaces. */
export function merge<T>(base: T, part: DeepPartial<T> | Partial<T> | undefined): T {
  if (part === undefined) return base;
  if (!plain(base) || !plain(part)) return part as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(part)) {
    if (v === undefined) continue;
    out[k] = plain(out[k]) && plain(v) ? merge(out[k], v) : v;
  }
  return out as T;
}

/** A deep copy of plain data. */
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
