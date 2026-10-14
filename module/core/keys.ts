// Keys (specification B1): exact comparison, and the JSON text used by the fingerprint.
import type { Key } from './types.ts';

export const MAX_SAFE = 2 ** 53 - 1;

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** A key is a non-empty text without lone surrogates, or a whole number within ±(2^53 − 1). */
export function isKey(value: unknown): value is Key {
  if (typeof value === 'number') return Number.isInteger(value) && Math.abs(value) <= MAX_SAFE;
  if (typeof value === 'string') return value !== '' && !LONE_SURROGATE.test(value);
  return false;
}

/** Turns −0 into 0, so that every whole number has one form. */
export function normKey(k: Key): Key {
  return k === 0 ? 0 : k;
}

/** The key as JSON text: plain decimal for a number, JSON.stringify for a text. */
export function keyJson(k: Key): string {
  return typeof k === 'number' ? String(normKey(k)) : JSON.stringify(k);
}

/** Exact identity of a key: 1 and "1" differ. Equal to keyJson, which never holds a raw tab. */
export const keyId = keyJson;

/** Identity of a keypair. JSON texts hold no raw tab, so the tab separates them safely. */
export function keypairId(from: Key, to: Key): string {
  return keyJson(from) + '\t' + keyJson(to);
}

/** Compares two texts by Unicode code points, not by UTF-16 code units. */
export function compareCodePoints(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x === y) continue;
    // A surrogate (D800–DFFF) stands for a code point above FFFF, so it sorts after E000–FFFF.
    const sx = x >= 0xd800 && x <= 0xdfff;
    const sy = y >= 0xd800 && y <= 0xdfff;
    if (sx !== sy) return sx ? 1 : -1;
    return x - y;
  }
  return a.length - b.length;
}
