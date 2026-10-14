// The fingerprint "graphview-fp/1" (specification B3).
import { compareCodePoints, keyJson } from './keys.ts';
import { sha256Hex, utf8 } from './sha256.ts';
import type { Key } from './types.ts';

/** The fingerprint of accepted units and keypairs; nothing else counts. */
export function fingerprintOf(units: readonly Key[], keypairs: readonly (readonly [Key, Key])[]): string {
  const unitLines = units.map(keyJson).sort(compareCodePoints);
  const pairLines = keypairs.map(([a, b]) => keyJson(a) + '\t' + keyJson(b)).sort(compareCodePoints);
  const lines = ['graphview-fp/1', `U ${units.length}`, ...unitLines, `K ${keypairs.length}`, ...pairLines];
  return 'sha256:' + sha256Hex(utf8(lines.join('\n') + '\n'));
}
