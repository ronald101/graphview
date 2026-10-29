// A profile fits the module to a family of graphs without editing it (specification 5.7): the
// kinds of unit, a unit's class, complementary pairs of keypair types, checks of its own, what
// else supersedes a unit, the pair type of each perspective, and the graph the viewer shows. The
// model takes one; the public profile has the interface kind and nothing else.
import type { Graph, Key, KeypairInfo, UnitInfo } from '../core/index.ts';
import type { Perspective } from './contracts.ts';
import type { Kinds } from './kinds.ts';
import type { Relation } from './topology.ts';

/** A kind of unit besides plain (3.8). */
export interface KindRule {
  /** Its name, as the snapshot, the looks, the inspector's sections and the words know it. */
  id: string;
  /** Whether a unit is of this kind. Kinds are tried in order; a unit that none claims is plain. */
  claims: (info: UnitInfo | undefined, key: Key) => boolean;
  /** Whether its units join two others, their ends, as interfaces do; the interface checks then apply. */
  joins: boolean;
}

/** An issue a profile's check finds: a code of its own, and the fields its words need. */
export interface CheckIssue {
  code: string;
  [field: string]: unknown;
}

/** A check of the profile's own. It runs on the stored graph, after the core's issues and the interface checks. */
export interface Check {
  /** The codes it finds, so that their words can be found. */
  codes: readonly string[];
  find: (g: Graph, kinds: Kinds, relations: Relation[]) => CheckIssue[];
  /** One issue in plain words; `name` gives a unit's label, or its key. */
  words: (issue: CheckIssue, name: (k: Key) => string) => string;
}

export interface Profile {
  /** The kinds besides plain, in the order they are tried. */
  kinds: KindRule[];
  /** A unit's class: the type that colours it and counts in the Types panel. Without it the type field decides (6.6). */
  classOf?: (info: UnitInfo | undefined, key: Key) => string | null;
  /** Complementary pairs of keypair types, [forward, backward], ahead of the pairs the data shows (6.6). */
  pairs: [string, string][];
  checks: Check[];
  /** Whether a unit is superseded besides its row's mark, such as by a relation that supersedes it (3.5, 6.13). */
  superseded?: (g: Graph, key: Key) => boolean;
  /** The pair type of a perspective: an interface's relation seen from one end toward the other (3.8). */
  perspective?: (g: Graph, iface: Key, from: Key, to: Key) => string | null;
  /** The graph the viewer shows, made from the stored graph: a projection, such as interfaces folded into lines. */
  project?: (g: Graph, kinds: Kinds) => Graph;
  /** Whether a unit is a class unit, which the perspective drawing shows as a box (3.9, 6.18). */
  classUnit?: (info: UnitInfo | undefined, key: Key) => boolean;
  /** An interface's member pair and its perspectives, as its row holds them (3.9). */
  pairOf?: (info: UnitInfo | undefined) => { type: string | null; perspectives: Perspective[] } | null;
  /** A keypair's pair type: the type of the perspective it belongs to (3.9). */
  pairTypeOf?: (info: KeypairInfo | undefined) => string | null;
  /** An interface with one end, a unit's self-relation: allowed, or an interface-ends issue (3.8). Default "issue". */
  selfRelations?: 'allowed' | 'issue';
  /** Two plain units related directly: allowed, or a direct-relation issue (3.8). Default "allowed". */
  directRelations?: 'allowed' | 'issue';
}

/** The interface kind of the public version: a row with "interface": true. */
export const INTERFACE: KindRule = { id: 'interface', claims: (info) => info?.interface === true, joins: true };

export const PUBLIC_PROFILE: Profile = { kinds: [INTERFACE], pairs: [], checks: [] };
