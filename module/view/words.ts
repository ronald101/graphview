// Plain words for issues, refusals, keys and counts (specification 7.8 and 6.14).
import type { Issue, Key } from '../core/index.ts';
import type { Aspect, ModelIssue } from '../model/contracts.ts';
import type { KindIssue } from '../model/kinds.ts';
import type { GraphModel } from '../model/model.ts';
import type { Check, CheckIssue } from '../model/profile.ts';

export const keyText = (k: Key) => (typeof k === 'string' ? JSON.stringify(k) : String(k));

/** The issues whose words this module knows: the core's and the interface checks'. */
type KnownIssue = Issue | KindIssue;
type Words<C extends KnownIssue['code']> = (i: KnownIssue & { code: C }, name: (k: Key) => string) => string;

/** The words for each issue code the module knows; the type check finds a missing one. A profile's checks bring their own. */
export const ISSUE_WORDS: { [C in KnownIssue['code']]: Words<C> } = {
  'bad-row': (i) => `Row ${i.row} of ${i.list} is not a valid row.`,
  'bad-key': (i) => `Row ${i.row} of ${i.list} has a key that is not valid.`,
  'repeated-key': (i) => `Row ${i.row} of vertices repeats the key ${keyText(i.key)}.`,
  loop: (i) => `Row ${i.row} of edges joins ${keyText(i.keypair[0])} to itself.`,
  'unknown-unit': (i) =>
    `Row ${i.row} of edges names a unit that does not exist: ${keyText(i.keypair[0])} to ${keyText(i.keypair[1])}.`,
  'repeated-keypair': (i) =>
    `Row ${i.row} of edges repeats the keypair ${keyText(i.keypair[0])} to ${keyText(i.keypair[1])}.`,
  'missing-reverse': (i, name) => `The keypair from ${name(i.keypair[0])} to ${name(i.keypair[1])} has no reverse.`,
  orphan: (i, name) => `The unit ${name(i.key)} takes part in no relation.`,
  'fingerprint-mismatch': () => 'The stated fingerprint differs from the data.',
  'interface-ends': (i, name) => `The interface ${name(i.key)} joins ${count(i.ends, 'unit', 'units')}, not 2.`,
  'interface-pair': (i, name) =>
    `The interfaces ${name(i.keypair[0])} and ${name(i.keypair[1])} are related directly; an interface joins two plain units.`,
};

/** An issue in plain words: the module's own words for its codes, else the words of the check that found it. */
export function issueWords(i: ModelIssue, name: (k: Key) => string, checks: readonly Check[] = []): string {
  if (Object.hasOwn(ISSUE_WORDS, i.code))
    return (ISSUE_WORDS[i.code as KnownIssue['code']] as Words<KnownIssue['code']>)(i as KnownIssue, name);
  const check = checks.find((c) => c.codes.includes(i.code));
  return check ? check.words(i as CheckIssue, name) : i.code;
}

/** Numbers in words for counts in headings, such as "81 units, 84 relations, no issues". */
export function count(n: number, one: string, many: string): string {
  return n === 0 ? `no ${many}` : `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
}

/** What the live region says after a change (specification 6.14), or null when there is nothing to say. */
export function announce(m: GraphModel, a: ReadonlySet<Aspect>): string | null {
  if (a.has('graph')) return m.graph ? `Graph loaded: ${count(m.graph.units.length, 'unit', 'units')}` : null;
  if (a.has('mode')) return m.mode === '3d' ? '3D view' : '2D view';
  if (a.has('root')) return m.root === null ? 'Root cleared' : `Root ${m.label(m.root)}`;
  if (a.has('paths')) {
    if (m.root === null) return null;
    if (m.target === null) return 'Path cleared';
    if (!m.paths) return null;
    const ends = `from ${m.label(m.root)} to ${m.label(m.target)}`;
    const n = m.paths.shortest;
    return n === null ? `No path ${ends}` : `Shortest path ${ends}: ${n} ${n === 1 ? 'step' : 'steps'}`;
  }
  if (a.has('inspect')) {
    const i = m.inspected;
    if (!i) return 'Inspector cleared';
    if (i.kind === 'unit')
      return `Inspecting ${m.kindOf(i.key) === 'interface' ? 'interface' : 'unit'} ${m.label(i.key)}`;
    if (i.kind === 'keypair') return `Inspecting keypair from ${m.label(i.from)} to ${m.label(i.to)}`;
    return `Inspecting relation between ${m.label(i.a)} and ${m.label(i.b)}`;
  }
  return null;
}

/**
 * One message for one action. A click on a unit both sets the root and inspects it; the root is
 * what changed, so messages about the inspector give way to any other message of the same action.
 */
export function oneMessage(messages: string[]): string {
  const main = messages.filter((t) => !t.startsWith('Inspect'));
  return (main.length ? main : messages).join('. ');
}
