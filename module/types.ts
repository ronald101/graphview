// The module's interface types (specification Part D).
import type { Key, PathSetResult, TokenName } from './core/index.ts';

export type LayoutName = 'force' | 'rings' | 'circle' | 'grid' | 'given';

export interface ViewState {
  format: 'graphview-view/1';
  graph: string | null;
  focus: Key | null;
  radius: number | null;
  beyond: 'fade' | 'hide';
  selection: { units: Key[]; keypairs: [Key, Key][] };
  camera: { x: number; y: number; zoom: number; angle: number };
  layout: {
    name: LayoutName;
    seed: number;
    settings: Record<string, number | string | boolean>;
    pinned: { key: Key; x: number; y: number }[];
  };
  paths: {
    ends: [Key, Key] | null;
    extra: number;
    lit: { length: number; index: number } | null;
    showAll: number | null;
  };
  filters: { hideLoneUnits: boolean };
  overlays: string[];
  frame: number | null;
}

export interface Overlay {
  id: string;
  label: string;
  kind: 'set' | 'values' | 'groups' | 'path' | 'rings' | 'frames';
  items: unknown[];
  badge?: string;
  graph: string;
}

export interface Look {
  theme: 'light' | 'dark' | 'system';
  tokens: Partial<Record<TokenName, string>>;
  font: string;
  labels: { field: 'label' | 'key' | `attrs.${string}`; show: 'auto' | 'always' | 'never' };
  relations: {
    draw: 'halves' | 'arrows' | 'lines';
    icons: 'by-zoom' | 'always' | 'never';
    colour: 'neutral' | 'around-selection' | { attr: string };
  };
  superseded: 'show' | 'fade' | 'hide';
  gestures: { pan: boolean; zoom: boolean; rotate: boolean; dragUnits: boolean; keyboard: boolean };
  motion: 'on' | 'off' | 'system';
  panels: { details: boolean; paths: boolean; issues: boolean; key: boolean };
  limits: { pathCount: number; pathList: number; pathTimeMs: number; maxExtra: number };
}

export type SelectEvent = { units: Key[]; keypairs: [Key, Key][] };
export type HoverEvent = { unit: Key | null; keypair: [Key, Key] | null };
export type ActivateEvent = { unit: Key } | { keypair: [Key, Key] };
export type FocusEvent = { focus: Key | null; radius: number | null };
export type CameraEvent = ViewState['camera'];
export type LayoutSettledEvent = { name: string; positions: { key: Key; x: number; y: number }[] };
export type IssueItem =
  | import('./core/index.ts').Issue
  | { code: 'overlay-mismatch'; overlay: string }
  | { code: 'refused'; refusal: import('./core/index.ts').RefusalCode };

export interface GraphViewEvents {
  onselect?: (e: SelectEvent) => void;
  onhover?: (e: HoverEvent) => void;
  onactivate?: (e: ActivateEvent) => void;
  onfocus?: (e: FocusEvent) => void;
  oncamera?: (e: CameraEvent) => void;
  onviewstate?: (e: ViewState) => void;
  onlayoutsettled?: (e: LayoutSettledEvent) => void;
  onpathset?: (e: PathSetResult) => void;
  onexpandrequest?: (e: unknown) => void;
  onissues?: (e: IssueItem[]) => void;
}

export interface GraphViewProps extends GraphViewEvents {
  graph: unknown;
  view?: Partial<ViewState>;
  overlays?: Overlay[];
  look?: DeepPartial<Look>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

export interface Point {
  x: number;
  y: number;
}

export interface SceneUnit {
  key: Key;
  x: number;
  y: number;
  r: number;
  visible: boolean;
  state: {
    focus: boolean;
    selected: boolean;
    hovered: boolean;
    dimmed: boolean;
    faded: boolean;
    pinned: boolean;
    issue: boolean;
    superseded: boolean;
    ring: number | null;
  };
  label: { text: string; visible: boolean; angle: number; box: { x: number; y: number; w: number; h: number } | null };
}

export type HalfRole = 'context' | 'outgoing' | 'incoming' | 'path' | 'issue' | `attr:${string}`;

export interface SceneHalf {
  from: Key;
  to: Key;
  start: Point;
  end: Point;
  visible: boolean;
  missing: boolean;
  style: 'solid' | 'dashed';
  role: HalfRole;
  width: number;
  selected: boolean;
  hovered: boolean;
  icon: boolean;
  superseded: boolean;
  faded: boolean;
}

export interface Scene {
  graph: 'stored' | 'current';
  fingerprint: string;
  width: number;
  height: number;
  camera: { x: number; y: number; zoom: number; angle: number };
  units: SceneUnit[];
  halves: SceneHalf[];
  rings: { index: number; radius: number }[];
}

export type Release2 = { ok: false; reason: 'release-2' };

export interface GraphViewCommands {
  fit(target?: 'all' | 'selection'): Promise<void>;
  flyTo(key: Key): Promise<void>;
  rotateTo(angle: number): Promise<void>;
  setLayout(layout: Partial<ViewState['layout']> & { name: LayoutName }): Promise<void>;
  showPaths(from: Key, to: Key, extra: number): Promise<PathSetResult>;
  spotlight(...args: unknown[]): Release2;
  play(): Release2;
  pause(): Release2;
  step(delta: number): Release2;
  seek(frame: number): Release2;
  exportPicture(options?: { scale?: 1 | 2; background?: boolean }): Promise<Blob>;
  getViewState(): ViewState;
  setViewState(partial: Partial<ViewState>): Promise<void>;
  getScene(): Scene;
}
