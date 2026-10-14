// Types of the core (specification, Parts B and C).

export type Key = string | number;

export interface UnitInfo {
  label?: string;
  attrs?: Record<string, unknown>;
  pos?: { x: number; y: number };
  superseded: boolean;
}

export interface KeypairInfo {
  attrs?: Record<string, unknown>;
  superseded: boolean;
}

export interface Graph {
  /** Accepted units, in file order. */
  units: Key[];
  /** Accepted keypairs, in file order. */
  keypairs: [Key, Key][];
  /** Row data by key id (see keyId). */
  readonly unitInfo: ReadonlyMap<string, UnitInfo>;
  /** Row data by keypair id (see keypairId). */
  readonly keypairInfo: ReadonlyMap<string, KeypairInfo>;
  /** The document's meta object, kept as read. */
  readonly meta: Record<string, unknown>;
}

export type RowIssue =
  | { code: 'bad-row' | 'bad-key'; list: 'vertices' | 'edges'; row: number }
  | { code: 'repeated-key'; list: 'vertices'; row: number; key: Key }
  | { code: 'loop' | 'unknown-unit' | 'repeated-keypair'; list: 'edges'; row: number; keypair: [Key, Key] };

export type Issue =
  | RowIssue
  | { code: 'missing-reverse'; keypair: [Key, Key] }
  | { code: 'orphan'; key: Key }
  | { code: 'fingerprint-mismatch'; stated: string };

export type RefusalCode = 'not-object' | 'format' | 'vertices' | 'edges';

export type LoadResult =
  { ok: true; graph: Graph; issues: Issue[] } | { ok: false; code: RefusalCode; message: string };

export interface PathSetLength {
  length: number;
  count: number;
  exact: boolean;
  paths: Key[][];
}

export interface PathSetResult {
  from: Key;
  to: Key;
  extra: number;
  shortest: number | null;
  reason: 'same-unit' | 'unreachable' | null;
  lengths: PathSetLength[];
  total: number;
  stopped: boolean;
  stoppedBy: 'count' | 'time' | null;
}

export interface PathLimits {
  count?: number;
  list?: number;
  timeMs?: number;
}
