// The contracts between the parts of the viewer: the model holds the state, the scene draws it,
// the panels show and change it. Every change goes to the model first; the model then tells its
// listeners which aspects changed, and they redraw from the model.
import type { Issue, Key, PathLimits, PathSetResult } from '../core/index.ts';
import type { KindIssue } from './kinds.ts';
import type { CheckIssue } from './profile.ts';

/** The 2D view keeps every unit on one plane; the 3D view moves units back by their degree. */
export type Mode = '2d' | '3d';

/** An issue the Data issues panel lists: the core's, the interface checks', or the profile's checks'. */
export type ModelIssue = Issue | KindIssue | CheckIssue;

/** An interface's relation seen from one end toward the other, with its pair type when the profile names one (3.8). */
export interface Perspective {
  from: Key;
  to: Key;
  type: string | null;
}

/** What a change touched, so that listeners redo only their share. */
export type Aspect =
  | 'graph' // a new graph: everything below changed too
  | 'layout' // the units' places
  | 'mode'
  | 'root'
  | 'paths'
  | 'filters'
  | 'types' // type labels and colours
  | 'display' // size, width and opacity factors, hulls
  | 'inspect'
  | 'theme'
  | 'settings' // settings changed: model.changedSettings names them
  | 'selection'
  | 'highlight'
  | 'scope'
  | 'search'; // the search text and its results (6.19)

export type Listener = (aspects: ReadonlySet<Aspect>) => void;

/** A type of unit or keypair: its value in the data, the label people see, its colour. */
export interface TypeInfo {
  /** The value in the data, as text. */
  id: string;
  label: string;
  colour: string;
  count: number;
  /** Its place in the shaders' palette. */
  slot: number;
}

/** Keypair types pair up: the type of (a, b) and the type of its reverse (b, a). */
export interface TypePair {
  forward: string;
  /** Null when no keypair of this type has a reverse with a type. */
  backward: string | null;
}

export interface Filters {
  timeField: string | null;
  /** Inclusive window in milliseconds; null ends are open. */
  from: number | null;
  to: number | null;
  weightField: string | null;
  /** Keypairs at or above it are above the threshold; null means no threshold. */
  threshold: number | null;
}

/** Factors the shaders apply to unit size, line width and opacity. */
export interface Overrides {
  size: number;
  width: number;
  opacity: number;
}

/** What the inspector shows: a unit, one keypair (a chevron), or a relation (its line). */
/** What the inspector shows: a unit, a keypair (a chevron), a relation (a line), a perspective (a chevron of the perspective drawing, 6.18), or nothing. */
export type Inspected =
  | { kind: 'unit'; key: Key }
  | { kind: 'keypair'; from: Key; to: Key }
  | { kind: 'relation'; a: Key; b: Key }
  | { kind: 'perspective'; iface: Key; from: Key; to: Key }
  | null;

/** One path of the path set, by its length and its place in that length's list. */
export interface PathChoice {
  length: number;
  index: number;
}

/** One step of the active path, for the path table. */
export interface PathStep {
  key: Key;
  label: string;
  /** The keypair from this unit to the next, and its reverse; null on the last unit. */
  to: { type: string | null; weight: number | null } | null;
  from: { type: string | null; weight: number | null } | null;
}

/** Units per plane around the root. */
export interface PlaneCounts {
  first: number;
  second: number;
  third: number;
  farBack: number;
  /** The highest degree any unit reaches; null without a root. */
  deepest: number | null;
}

/** The view settings a saved file and a share link carry, so that a graph opens as it was left. */
export interface ViewSettings {
  mode: Mode;
  root: Key | null;
  target: Key | null;
  path: PathChoice | null;
  filters: Partial<Filters>;
  overrides: Overrides;
  hulls: boolean;
  types: {
    unit: Record<string, { label?: string; colour?: string }>;
    keypair: Record<string, { label?: string; colour?: string }>;
  };
  camera: { position: [number, number, number]; target: [number, number, number] } | null;
}

/** Distances and path sets, computed off the main thread. */
export interface GraphWorker {
  distances(root: Key): Promise<number[]>;
  paths(from: Key, to: Key, extra: number, limits: PathLimits): Promise<PathSetResult>;
  terminate(): void;
}

/** How a filter rule treats what fails it (6.7). */
export type FilterMode = 'show' | 'fade' | 'hide';

/** A filter rule: one thing that units or keypairs are, and what becomes of those it names (6.7). */
export interface FilterRule {
  field: 'class' | 'type' | 'kind' | 'pairType' | 'superseded' | 'degree';
  /** The class, type, kind or pair type; null for superseded and degree. */
  value: string | null;
  /** The range of relations per unit that stays shown; degree only. */
  range: [number, number] | null;
  mode: FilterMode;
}

/** How a selection changes (6.20). */
export type SelectHow = 'replace' | 'add' | 'toggle' | 'remove' | 'clear';

/** A highlight group (6.20): its units, whether it is on, and whether a person saved it from the selection. */
export interface HighlightGroup {
  name: string;
  keys: Key[];
  on: boolean;
  saved: boolean;
}

/** The scope (6.21): the units it was shown around, and every unit it holds. */
export interface Scope {
  centres: Key[];
  units: Key[];
}

/** A unit the search found (6.19): its rank, lower first, and where the text matched: label, key, class, type or an attribute's name. */
export interface SearchResult {
  key: Key;
  rank: number;
  where: string;
}
