// The settings (specification 5.9): one class per kind of control, one instance per setting, each
// with a hard-coded default. The value is Svelte state, so that controls follow it; the model is its
// only writer, through the registry (registry.svelte.ts).
import { tokens, type TokenName } from '../core/index.ts';

export type Control =
  | 'checkbox'
  | 'slider'
  | 'number'
  | 'range'
  | 'select'
  | 'text'
  | 'colour'
  | 'theme-colour'
  | 'palette'
  | 'order'
  | 'set'
  | 'keys'
  | 'json';

/** At once, or with the next graph. */
export type Applies = 'live' | 'load';

/** What every setting is given. */
export interface Common<T, K extends string> {
  key: K;
  label: string;
  group: string;
  description: string;
  default: T;
  applies?: Applies;
}

export abstract class Setting<T = unknown, K extends string = string> {
  readonly key: K;
  readonly label: string;
  readonly group: string;
  readonly description: string;
  readonly default: T;
  readonly applies: Applies;
  abstract readonly control: Control;
  /** The value in use: the top layer that holds one (registry.svelte.ts). Replaced, never changed in place. */
  value: T = $state.raw(undefined as T);
  /** Shown in the side bar as well. */
  pinned = $state(false);

  constructor(c: Common<T, K>) {
    this.key = c.key;
    this.label = c.label;
    this.group = c.group;
    this.description = c.description;
    this.default = frozen(c.default);
    this.applies = c.applies ?? 'live';
    this.value = this.default;
  }

  /** The value when it is allowed, else undefined. */
  abstract check(v: unknown): T | undefined;

  /** What the setting allows, in words, for the note on a refused value. */
  abstract allowed(): string;
}

// ---------------------------------------------------------------- helpers

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const plain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/** A number as the notes write it: 0.05, 12, 1,000. */
export const num = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 6 });

/** Colours are #RGB or #RRGGBB. */
export const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export const TOKEN_NAMES = Object.keys(tokens.light) as TokenName[];
export const isToken = (v: unknown): v is TokenName => typeof v === 'string' && (TOKEN_NAMES as string[]).includes(v);

/** Equal as JSON values: the same numbers, texts, lists and fields, in any field order. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (plain(a) && plain(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
  }
  return false;
}

/** A deep copy that nobody can change, so that defaults stay as written. */
function frozen<T>(v: T): T {
  if (typeof v !== 'object' || v === null) return v;
  const copy = Array.isArray(v) ? v.map(frozen) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, frozen(x)]));
  return Object.freeze(copy) as T;
}

/** A JSON value, or undefined for anything JSON cannot hold. */
function json(v: unknown): unknown {
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || finite(v)) return v;
  if (Array.isArray(v)) {
    const out = v.map(json);
    return out.includes(undefined) ? undefined : out;
  }
  if (plain(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if ((out[k] = json(x)) === undefined) return undefined;
    return out;
  }
  return undefined;
}

// ---------------------------------------------------------------- the classes

export class CheckboxSetting<K extends string> extends Setting<boolean, K> {
  readonly control = 'checkbox';
  check(v: unknown) {
    return typeof v === 'boolean' ? v : undefined;
  }
  allowed() {
    return 'On or off';
  }
}

export class SliderSetting<K extends string> extends Setting<number, K> {
  readonly control = 'slider';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Shown after the number, such as px or ms. */
  readonly unit: string;
  constructor(c: Common<number, K> & { min: number; max: number; step: number; unit?: string }) {
    super(c);
    [this.min, this.max, this.step, this.unit] = [c.min, c.max, c.step, c.unit ?? ''];
  }
  check(v: unknown) {
    return finite(v) && v >= this.min && v <= this.max ? v : undefined;
  }
  allowed() {
    return `From ${num(this.min)} to ${num(this.max)}`;
  }
}

/** A number in a field; with `none`, also null, named by that word. */
export class NumberSetting<K extends string, T extends number | null = number> extends Setting<T, K> {
  readonly control = 'number';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly whole: boolean;
  readonly unit: string;
  readonly none: string | null;
  constructor(
    c: Common<T, K> & { min?: number; max?: number; step?: number; whole?: boolean; unit?: string; none?: string },
  ) {
    super(c);
    this.min = c.min ?? -Infinity;
    this.max = c.max ?? Infinity;
    this.whole = c.whole ?? false;
    this.step = c.step ?? (this.whole ? 1 : 0.01);
    this.unit = c.unit ?? '';
    this.none = c.none ?? null;
  }
  check(v: unknown) {
    if (v === null) return this.none === null ? undefined : (null as T);
    if (!finite(v) || v < this.min || v > this.max || (this.whole && !Number.isInteger(v))) return undefined;
    return v as T;
  }
  allowed() {
    const what = this.whole ? 'A whole number' : 'A number';
    const lo = Number.isFinite(this.min);
    const hi = Number.isFinite(this.max);
    const range = lo && hi ? ` from ${num(this.min)} to ${num(this.max)}` : lo ? ` from ${num(this.min)}` : '';
    const upTo = !lo && hi ? ` up to ${num(this.max)}` : '';
    return `${what}${range}${upTo}${this.none === null ? '' : `, or ${this.none}`}`;
  }
}

export class RangeSetting<K extends string> extends Setting<[number, number], K> {
  readonly control = 'range';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  constructor(c: Common<[number, number], K> & { min: number; max: number; step: number }) {
    super(c);
    [this.min, this.max, this.step] = [c.min, c.max, c.step];
  }
  check(v: unknown): [number, number] | undefined {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(finite)) return undefined;
    const [lo, hi] = v as [number, number];
    return lo >= this.min && hi <= this.max && lo <= hi ? [lo, hi] : undefined;
  }
  allowed() {
    return `Two numbers from ${num(this.min)} to ${num(this.max)}, the lower first`;
  }
}

export class SelectSetting<K extends string, const T extends string = string> extends Setting<T, K> {
  readonly control = 'select';
  /** Each value with its words. */
  readonly options: readonly (readonly [T, string])[];
  constructor(c: Common<NoInfer<T>, K> & { options: readonly (readonly [T, string])[] }) {
    super(c);
    this.options = c.options;
  }
  check(v: unknown) {
    return this.options.some(([o]) => o === v) ? (v as T) : undefined;
  }
  allowed() {
    return `One of ${this.options.map(([, l]) => l).join(', ')}`;
  }
}

export class TextSetting<K extends string> extends Setting<string, K> {
  readonly control = 'text';
  readonly pattern: RegExp | null;
  /** What the pattern asks for, in words. */
  readonly asks: string;
  /** Texts that hold a regular expression are checked to compile. */
  readonly regex: boolean;
  constructor(c: Common<string, K> & { pattern?: RegExp; asks?: string; regex?: boolean }) {
    super(c);
    this.pattern = c.pattern ?? null;
    this.asks = c.asks ?? 'Any text';
    this.regex = c.regex ?? false;
  }
  check(v: unknown) {
    if (typeof v !== 'string' || (this.pattern && !this.pattern.test(v))) return undefined;
    if (this.regex) {
      try {
        new RegExp(v);
      } catch {
        return undefined;
      }
    }
    return v;
  }
  allowed() {
    return this.regex ? 'A regular expression' : this.asks;
  }
}

/** A colour, or with `tokens` also the name of a colour token, which follows the theme. */
export class ColourSetting<K extends string> extends Setting<string, K> {
  readonly control = 'colour';
  readonly tokens: boolean;
  constructor(c: Common<string, K> & { tokens?: boolean }) {
    super(c);
    this.tokens = c.tokens ?? true;
  }
  check(v: unknown) {
    return typeof v === 'string' && (HEX.test(v) || (this.tokens && isToken(v))) ? v : undefined;
  }
  allowed() {
    return this.tokens ? 'A colour such as #2A78D6, or a token name such as ink-1' : 'A colour such as #2A78D6';
  }
}

export interface ThemeColour {
  light: string;
  dark: string;
}

export class ThemeColourSetting<K extends string> extends Setting<ThemeColour, K> {
  readonly control = 'theme-colour';
  check(v: unknown) {
    return plain(v) &&
      typeof v.light === 'string' &&
      typeof v.dark === 'string' &&
      HEX.test(v.light) &&
      HEX.test(v.dark)
      ? { light: v.light, dark: v.dark }
      : undefined;
  }
  allowed() {
    return 'A colour such as #2A78D6 for each theme';
  }
}

export interface Palette {
  light: string[];
  dark: string[];
}

export class PaletteSetting<K extends string> extends Setting<Palette, K> {
  readonly control = 'palette';
  /** The most colours per theme. */
  readonly most: number;
  constructor(c: Common<Palette, K> & { most: number }) {
    super(c);
    this.most = c.most;
  }
  check(v: unknown) {
    const ok = (x: unknown): x is string[] =>
      texts(x) && x.length >= 1 && x.length <= this.most && x.every((c) => HEX.test(c));
    return plain(v) && ok(v.light) && ok(v.dark) ? { light: [...v.light], dark: [...v.dark] } : undefined;
  }
  allowed() {
    return `From 1 to ${this.most} colours for each theme`;
  }
}

/** Items in an order of a person's choice: each at most once, with `all` each exactly once, and at least `least` of them. */
export class OrderSetting<K extends string, const T extends string = string> extends Setting<T[], K> {
  readonly control = 'order';
  readonly items: readonly (readonly [T, string])[];
  readonly all: boolean;
  readonly least: number;
  constructor(
    c: Common<NoInfer<T>[], K> & { items: readonly (readonly [T, string])[]; all?: boolean; least?: number },
  ) {
    super(c);
    this.items = c.items;
    this.all = c.all ?? false;
    this.least = this.all ? c.items.length : (c.least ?? 0);
  }
  check(v: unknown) {
    if (!texts(v) || new Set(v).size !== v.length || !v.every((x) => this.items.some(([i]) => i === x)))
      return undefined;
    return v.length < this.least ? undefined : (v as T[]);
  }
  allowed() {
    const names = this.items.map(([, l]) => l).join(', ');
    if (this.all) return `Each of ${names}, once, in any order`;
    return `${this.least > 0 ? `At least ${this.least} of` : 'Any of'} ${names}, each once, in any order`;
  }
}

/** Any of the items, at least `least` of them, kept in the items' order. */
export class SetSetting<K extends string, const T extends string = string> extends Setting<T[], K> {
  readonly control = 'set';
  readonly items: readonly (readonly [T, string])[];
  readonly least: number;
  constructor(c: Common<NoInfer<T>[], K> & { items: readonly (readonly [T, string])[]; least?: number }) {
    super(c);
    this.items = c.items;
    this.least = c.least ?? 0;
  }
  check(v: unknown) {
    if (!texts(v) || !v.every((x) => this.items.some(([i]) => i === x))) return undefined;
    const out = this.items.map(([i]) => i).filter((i) => v.includes(i));
    return out.length < this.least ? undefined : out;
  }
  allowed() {
    return `${this.least > 0 ? `At least ${this.least} of` : 'Any of'} ${this.items.map(([, l]) => l).join(', ')}`;
  }
}

/** Keys of the keyboard, each bound to one of the actions. */
export class KeysSetting<K extends string, const A extends string = string> extends Setting<Record<string, A>, K> {
  readonly control = 'keys';
  readonly actions: readonly (readonly [A, string])[];
  constructor(c: Common<NoInfer<Record<string, A>>, K> & { actions: readonly (readonly [A, string])[] }) {
    super(c);
    this.actions = c.actions;
  }
  check(v: unknown) {
    if (!plain(v)) return undefined;
    const ok = Object.entries(v).every(([k, a]) => k.length > 0 && this.actions.some(([x]) => x === a));
    return ok ? ({ ...v } as Record<string, A>) : undefined;
  }
  allowed() {
    return `Keys, each bound to one of ${this.actions.map(([, l]) => l).join(', ')}`;
  }
}

/** Any JSON value; with `test`, only the values it accepts, which `asks` describes. */
export class JsonSetting<K extends string, T = unknown> extends Setting<T, K> {
  readonly control = 'json';
  readonly test: ((v: unknown) => boolean) | null;
  readonly asks: string;
  constructor(c: Common<T, K> & { test?: (v: unknown) => boolean; asks?: string }) {
    super(c);
    this.test = c.test ?? null;
    this.asks = c.asks ?? 'Any JSON value';
  }
  check(v: unknown) {
    const out = json(v);
    return out === undefined || (this.test && !this.test(out)) ? undefined : (out as T);
  }
  allowed() {
    return this.asks;
  }
}
