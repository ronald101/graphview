// Share links: where the graph came from, and how it was viewed, in the address.
import type { Key, ViewSettings } from '../../module/index.ts';
import { NO_BREAKS, type BreakOptions } from './breakRules.ts';
import { DECORATE_DEFAULTS, type DecorateOptions } from './decorate.ts';
import { FAMILIES, type Family, type Params } from './generate.ts';

/** Generated graphs and examples: interfaces is the share of relations through an interface, above 0 and at most 1; absent is 0. */
export type Source =
  | { kind: 'example'; id: string; decorate: DecorateOptions | null; interfaces?: number }
  | { kind: 'url'; url: string }
  | {
      kind: 'generated';
      family: Family;
      params: Params;
      seed: number;
      breaks: BreakOptions;
      decorate: DecorateOptions | null;
      interfaces?: number;
    }
  | { kind: 'file'; name: string };

/** The parts of the view a link keeps. */
export type LinkView = Pick<ViewSettings, 'mode' | 'root' | 'target' | 'path'>;

export function makeLink(base: string, source: Source | null, view: LinkView): string {
  const q = new URLSearchParams();
  if (source?.kind === 'example') {
    q.set('example', source.id);
    if (source.decorate) q.set('decorate', JSON.stringify(source.decorate));
    if (source.interfaces) q.set('interfaces', String(source.interfaces));
  } else if (source?.kind === 'url') q.set('url', source.url);
  else if (source?.kind === 'generated') {
    const { family, params, seed, breaks, decorate, interfaces } = source;
    q.set('gen', JSON.stringify({ family, params, seed, breaks, decorate, interfaces }));
  }
  q.set('mode', view.mode);
  if (view.root !== null) q.set('view', JSON.stringify(view));
  return `${base}?${q.toString()}`;
}

export interface ReadLink {
  source: Source | null;
  view: Partial<LinkView>;
  error: string | null;
}

export const LINK_GRAPH_ERROR = 'The graph in the link could not be read.';

const isKey = (v: unknown): v is Key => typeof v === 'number' || typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The share of interfaces from a link, as a source holds it: absent when missing or 0; else a number up to 1. */
function shareOf(value: unknown): { interfaces?: number } {
  const v = value ?? 0;
  if (!isNumber(v) || v < 0 || v > 1) throw new Error("The link's share of interfaces is not from 0 to 1.");
  return v > 0 ? { interfaces: v } : {};
}

/** Settings from a link, shaped like their defaults: each a number, or a list of numbers where the default is one. */
function like<T extends object>(defaults: T, value: unknown): T {
  const given = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, d] of Object.entries(defaults)) {
    const v = given[k] ?? d;
    const ok = Array.isArray(d) ? Array.isArray(v) && v.length > 0 && v.every(isNumber) : isNumber(v);
    if (!ok) throw new Error(`The link's ${k} is not a number.`);
    out[k] = v;
  }
  return out as T;
}

export function readLink(search: string): ReadLink {
  const q = new URLSearchParams(search);
  const out: ReadLink = { source: null, view: {}, error: null };
  const mode = q.get('mode');
  if (mode === '2d' || mode === '3d') out.view.mode = mode;
  try {
    const v = q.get('view') ? JSON.parse(q.get('view')!) : null;
    if (v && typeof v === 'object') {
      if (isKey(v.root)) out.view.root = v.root;
      if (isKey(v.target)) out.view.target = v.target;
      if (v.path && typeof v.path.length === 'number' && typeof v.path.index === 'number') out.view.path = v.path;
    }
  } catch {
    out.error = 'The view in the link could not be read.';
  }
  try {
    if (q.get('gen')) {
      const g = JSON.parse(q.get('gen')!);
      const family = FAMILIES.find((f) => f.id === g?.family);
      if (!family || !Number.isInteger(g.seed)) throw new Error('No such family or seed.');
      out.source = {
        kind: 'generated',
        family: family.id,
        params: like(family.params, g.params),
        seed: g.seed,
        breaks: like(NO_BREAKS, g.breaks),
        decorate: g.decorate ? like(DECORATE_DEFAULTS, g.decorate) : null,
        ...shareOf(g.interfaces),
      };
    } else if (q.get('url')) out.source = { kind: 'url', url: q.get('url')! };
    else if (q.get('example')) {
      const d = q.get('decorate');
      out.source = {
        kind: 'example',
        id: q.get('example')!,
        decorate: d ? like(DECORATE_DEFAULTS, JSON.parse(d)) : null,
        ...shareOf(q.get('interfaces') === null ? 0 : Number(q.get('interfaces'))),
      };
    }
  } catch {
    // The view belongs to the graph in the link: without the graph, only the mode stays.
    out.view = out.view.mode ? { mode: out.view.mode } : {};
    out.error = LINK_GRAPH_ERROR;
  }
  return out;
}
