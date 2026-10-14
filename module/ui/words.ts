// Plain words for issues and keys (specification V21 and F7).
import type { Key } from '../core/index.ts';
import type { IssueItem } from '../types.ts';

export const keyText = (k: Key) => (typeof k === 'string' ? JSON.stringify(k) : String(k));

export function issueWords(i: IssueItem, name: (k: Key) => string): string {
  switch (i.code) {
    case 'bad-row':
      return `Row ${i.row} of ${i.list} is not a valid row.`;
    case 'bad-key':
      return `Row ${i.row} of ${i.list} has a key that is not valid.`;
    case 'repeated-key':
      return `Row ${i.row} of vertices repeats the key ${keyText(i.key)}.`;
    case 'loop':
      return `Row ${i.row} of edges joins ${keyText(i.keypair[0])} to itself.`;
    case 'unknown-unit':
      return `Row ${i.row} of edges names a unit that does not exist: ${keyText(i.keypair[0])} to ${keyText(i.keypair[1])}.`;
    case 'repeated-keypair':
      return `Row ${i.row} of edges repeats the keypair ${keyText(i.keypair[0])} to ${keyText(i.keypair[1])}.`;
    case 'missing-reverse':
      return `The keypair from ${name(i.keypair[0])} to ${name(i.keypair[1])} has no reverse.`;
    case 'orphan':
      return `The unit ${name(i.key)} takes part in no relation.`;
    case 'fingerprint-mismatch':
      return 'The stated fingerprint differs from the data.';
    case 'overlay-mismatch':
      return `The overlay ${i.overlay} was computed on another graph.`;
    case 'refused':
      return refusalWords(i.refusal);
  }
}

export function refusalWords(code: string): string {
  switch (code) {
    case 'not-object':
      return 'The file is not a JSON object.';
    case 'format':
      return 'The file is not in the format graphview-graph/1.';
    case 'vertices':
      return 'The file has no list of vertices.';
    case 'edges':
      return 'The file has no list of edges.';
    default:
      return 'The file was refused.';
  }
}

/** Numbers in words for counts in headings, such as "81 units, 84 relations, no issues". */
export function count(n: number, one: string, many: string): string {
  return n === 0 ? `no ${many}` : `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
}
