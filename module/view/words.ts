// Plain words for issues, refusals, keys and counts (specification 7.8 and 6.14), from the settings of
// the group "Words": templates whose braces the viewer fills in.
import type { Issue, Key } from '../core/index.ts';
import type { Aspect, ModelIssue } from '../model/contracts.ts';
import type { KindIssue } from '../model/kinds.ts';
import type { GraphModel } from '../model/model.ts';
import type { Check, CheckIssue } from '../model/profile.ts';
import { ISSUE_TEMPLATES } from '../settings/words.ts';

export const keyText = (k: Key) => (typeof k === 'string' ? JSON.stringify(k) : String(k));

/** A template with its braces filled in; a brace without a value stays as written. */
export const fill = (template: string, vars: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (all, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : all));

/** Numbers in words for counts in headings, such as "81 units, 84 relations, no issues". */
export function count(n: number, one: string, many: string, locale = 'en'): string {
  return n === 0 ? `no ${many}` : `${n.toLocaleString(locale)} ${n === 1 ? one : many}`;
}

/** The issues whose words this module knows: the core's and the interface checks'. */
type KnownIssue = Issue | KindIssue;
type Parts<C extends KnownIssue['code']> = (
  i: KnownIssue & { code: C },
  name: (k: Key) => string,
  locale: string,
) => Record<string, string | number>;

/** The values each issue's template may name; the type check finds a missing code. A profile's checks bring their own words. */
export const ISSUE_PARTS: { [C in KnownIssue['code']]: Parts<C> } = {
  'bad-row': (i) => ({ row: i.row, list: i.list }),
  'bad-key': (i) => ({ row: i.row, list: i.list }),
  'repeated-key': (i) => ({ row: i.row, key: keyText(i.key) }),
  loop: (i) => ({ row: i.row, from: keyText(i.keypair[0]) }),
  'unknown-unit': (i) => ({ row: i.row, from: keyText(i.keypair[0]), to: keyText(i.keypair[1]) }),
  'repeated-keypair': (i) => ({ row: i.row, from: keyText(i.keypair[0]), to: keyText(i.keypair[1]) }),
  'missing-reverse': (i, name) => ({ from: name(i.keypair[0]), to: name(i.keypair[1]) }),
  orphan: (i, name) => ({ unit: name(i.key) }),
  'fingerprint-mismatch': () => ({}),
  'interface-ends': (i, name, locale) => ({ unit: name(i.key), ends: count(i.ends, 'unit', 'units', locale) }),
  'interface-pair': (i, name) => ({ a: name(i.keypair[0]), b: name(i.keypair[1]) }),
  'direct-relation': (i, name) => ({ a: name(i.keypair[0]), b: name(i.keypair[1]) }),
};

/** An issue in plain words: the module's own templates for its codes, else the words of the check that found it. */
export function issueWords(
  i: ModelIssue,
  name: (k: Key) => string,
  checks: readonly Check[] = [],
  templates: Record<string, string> = ISSUE_TEMPLATES,
  locale = 'en',
): string {
  if (Object.hasOwn(ISSUE_PARTS, i.code)) {
    const parts = (ISSUE_PARTS[i.code as KnownIssue['code']] as Parts<KnownIssue['code']>)(
      i as KnownIssue,
      name,
      locale,
    );
    return fill(templates[i.code] ?? ISSUE_TEMPLATES[i.code], parts);
  }
  const check = checks.find((c) => c.codes.includes(i.code));
  return check ? check.words(i as CheckIssue, name) : i.code;
}

/** An issue in the words of a model's settings and profile. */
export const issueOf = (m: GraphModel, i: ModelIssue) =>
  issueWords(i, (k) => m.label(k), m.profile.checks, m.settings.get('words.issues'), m.settings.get('words.locale'));

/** A panel's text in the words of the settings: its replacement, or itself. */
export const say = (m: GraphModel, text: string, vars?: Record<string, string | number>) =>
  fill(m.settings.get('words.panels')[text] ?? text, vars);

/** One message of the live region, and whether it is about the inspector. */
export interface Message {
  text: string;
  inspector: boolean;
}

/** What the live region says after a change (specification 6.14), or null when there is nothing to say. */
export function announce(m: GraphModel, a: ReadonlySet<Aspect>): Message | null {
  const words = m.settings.get('words.live');
  const locale = m.settings.get('words.locale');
  const say = (name: string, vars?: Record<string, string | number>, inspector = false): Message => ({
    text: fill(words[name] ?? name, vars),
    inspector,
  });
  if (a.has('graph'))
    return m.graph ? say('graphLoaded', { units: count(m.graph.units.length, 'unit', 'units', locale) }) : null;
  if (a.has('mode')) return say(m.mode === '3d' ? 'mode3d' : 'mode2d');
  if (a.has('root')) return m.root === null ? say('rootCleared') : say('root', { unit: m.label(m.root) });
  if (a.has('paths')) {
    if (m.root === null) return null;
    if (m.target === null) return say('pathCleared');
    if (!m.paths) return null;
    const ends = { from: m.label(m.root), to: m.label(m.target) };
    const n = m.paths.shortest;
    return n === null ? say('noPath', ends) : say('shortest', { ...ends, steps: `${n} ${n === 1 ? 'step' : 'steps'}` });
  }
  if (a.has('inspect')) {
    const i = m.inspected;
    if (!i) return say('inspectorCleared', {}, true);
    if (i.kind === 'unit')
      return say(m.kindOf(i.key) === 'interface' ? 'inspectInterface' : 'inspectUnit', { unit: m.label(i.key) }, true);
    if (i.kind === 'keypair') return say('inspectKeypair', { from: m.label(i.from), to: m.label(i.to) }, true);
    if (i.kind === 'perspective') return say('inspectPerspective', { from: m.label(i.from), to: m.label(i.to) }, true);
    return say('inspectRelation', { a: m.label(i.a), b: m.label(i.b) }, true);
  }
  return null;
}

/**
 * One message for one action. A click on a unit both sets the root and inspects it; the root is
 * what changed, so messages about the inspector give way to any other message of the same action.
 */
export function oneMessage(messages: Message[]): string {
  const main = messages.filter((t) => !t.inspector);
  return (main.length ? main : messages).map((t) => t.text).join('. ');
}
