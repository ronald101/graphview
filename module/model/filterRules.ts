// Filter rules (specification 6.7): what units and keypairs are, each shown, faded or hidden. A unit
// takes the strictest rule that names it; a keypair takes the lesser of its units' shares and of the
// rules that name it; a line shows as much as its most shown keypair.
import type { Key } from '../core/index.ts';
import type { FilterMode, FilterRule } from './contracts.ts';

/** What the rules read of the units, by index, and of the keypairs. */
export interface RuleFacts {
  classOf(i: number): string | null;
  typeOf(i: number): string | null;
  kindOf(i: number): string;
  superseded(i: number): boolean;
  /** The unit's number of relations. */
  relations(i: number): number;
  keypairType(a: Key, b: Key): string | null;
  /** Whether the keypair's own row is superseded. */
  keypairSuperseded(a: Key, b: Key): boolean;
}

const FIELDS = ['class', 'type', 'kind', 'pairType', 'superseded', 'degree'] as const;
const MODES = ['show', 'fade', 'hide'] as const;

/** The share of a mode: whole, the fade, or nothing. */
export const modeShare = (mode: FilterMode, fade: number) => (mode === 'show' ? 1 : mode === 'fade' ? fade : 0);

/** Whether a value is a filter rule: a known field, a value or a range as the field asks, and a mode. */
export function isRule(v: unknown): v is FilterRule {
  const r = v as FilterRule;
  if (typeof v !== 'object' || v === null || !FIELDS.includes(r.field) || !MODES.includes(r.mode)) return false;
  if (r.field === 'degree')
    return (
      Array.isArray(r.range) &&
      r.range.length === 2 &&
      r.range.every((x) => typeof x === 'number' && Number.isFinite(x)) &&
      r.range[0] <= r.range[1]
    );
  if (r.field === 'superseded') return r.value === null;
  return typeof r.value === 'string';
}

/** The rules with one put in: it replaces the rule for the same thing, and a rule that shows removes it. */
export function withRule(rules: readonly FilterRule[], rule: FilterRule): FilterRule[] {
  const same = (r: FilterRule) =>
    r.field === rule.field && (r.field === 'superseded' || r.field === 'degree' || r.value === rule.value);
  const rest = rules.filter((r) => !same(r));
  return rule.mode === 'show' ? rest : [...rest, { ...rule }];
}

/** The mode a rule set gives one value of a field: its rule's, or show. */
export function modeOf(rules: readonly FilterRule[], field: FilterRule['field'], value: string | null): FilterMode {
  return rules.find((r) => r.field === field && r.value === value)?.mode ?? 'show';
}

/** How much of each unit the rules leave: 1, the fade, or 0. */
export function unitShares(n: number, rules: readonly FilterRule[], facts: RuleFacts, fade: number): Float32Array {
  const out = new Float32Array(n).fill(1);
  if (!rules.length) return out;
  for (let i = 0; i < n; i++) {
    for (const r of rules) {
      const named =
        r.field === 'class'
          ? facts.classOf(i) === r.value
          : r.field === 'type'
            ? facts.typeOf(i) === r.value
            : r.field === 'kind'
              ? facts.kindOf(i) === r.value
              : r.field === 'superseded'
                ? facts.superseded(i)
                : r.field === 'degree'
                  ? r.range !== null && (facts.relations(i) < r.range[0] || facts.relations(i) > r.range[1])
                  : false;
      if (named) out[i] = Math.min(out[i], modeShare(r.mode, fade));
    }
  }
  return out;
}

/** How much of a keypair the rules leave: the lesser of its units' shares and of the rules that name it. */
export function keypairShare(
  rules: readonly FilterRule[],
  facts: RuleFacts,
  a: Key,
  b: Key,
  units: number,
  fade: number,
): number {
  let share = units;
  for (const r of rules) {
    const named =
      r.field === 'pairType'
        ? facts.keypairType(a, b) === r.value
        : r.field === 'superseded' && facts.keypairSuperseded(a, b);
    if (named) share = Math.min(share, modeShare(r.mode, fade));
  }
  return share;
}
