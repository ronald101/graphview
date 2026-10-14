// A small stand-in for the parts of Vitest's API the tests use. Used only while
// the npm registry is unreachable; Vitest replaces it once packages install.
import { isDeepStrictEqual, inspect } from 'node:util';

export const registry = [];
const prefix = [];

export function describe(name, fn) {
  prefix.push(name);
  try {
    fn();
  } finally {
    prefix.pop();
  }
}
export function test(name, fn) {
  registry.push({ name: [...prefix, name].join(' > '), fn });
}
export const it = test;

// Vitest's toEqual ignores properties whose value is undefined.
function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, strip(x)]),
    );
  }
  return v;
}
function matches(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([k, v]) => matches(actual[k], v));
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => matches(actual[i], v))
    );
  }
  return Object.is(actual, expected);
}

export function expect(actual, message) {
  const fail = (what, expected) => {
    const show = (x) => inspect(x, { depth: 6, maxArrayLength: 20, breakLength: 120 });
    throw new Error(`${message ? message + ': ' : ''}expected ${show(actual)} ${what} ${show(expected)}`);
  };
  const api = {
    toBe: (e) => Object.is(actual, e) || fail('to be', e),
    toEqual: (e) => isDeepStrictEqual(strip(actual), strip(e)) || fail('to equal', e),
    toMatchObject: (e) => matches(actual, e) || fail('to match', e),
    toBeGreaterThanOrEqual: (e) => actual >= e || fail('>=', e),
    toBeLessThanOrEqual: (e) => actual <= e || fail('<=', e),
    toBeGreaterThan: (e) => actual > e || fail('>', e),
    toBeLessThan: (e) => actual < e || fail('<', e),
    toBeTruthy: () => !!actual || fail('to be', 'truthy'),
    toThrow: (e) => {
      try {
        actual();
      } catch (err) {
        if (e === undefined || String(err.message).includes(e)) return;
        fail('to throw', e);
      }
      fail('to throw', e ?? 'an error');
    },
  };
  return api;
}
