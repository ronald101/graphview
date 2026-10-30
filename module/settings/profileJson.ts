// A profile as JSON (specification 5.7), so that a host configures the viewer without code; the model
// builds a profile from it (model/profileJson.ts). The setting "Profile" may hold one.

export interface KindJson {
  id: string;
  /** The attribute to read; "interface" reads the row's own interface mark. */
  field: string;
  equals: unknown;
  /** Whether its units join two others, as interfaces do. */
  joins: boolean;
}

export interface ProfileJson {
  /** A unit is of the first kind whose field equals the value; without kinds, the public interface kind. */
  kinds?: KindJson[];
  /** The attribute holding a unit's class (3.9); default "class". */
  classField?: string;
  /** The attribute marking a class unit; default "classUnit". */
  classUnitField?: string;
  /** The attribute holding an interface's member pair; default "pair". */
  pairField?: string;
  /** The attribute holding a keypair's pair type; default "pairType". */
  pairTypeField?: string;
  /** Declared complementary pairs of keypair types. */
  pairs?: [string, string][];
  /** A unit that starts a perspective of one of these types is superseded. */
  supersededBy?: string[];
  /** Whether an interface with one end, a unit's self-relation, is allowed; default "issue" (3.8). */
  selfRelations?: 'allowed' | 'issue';
  /** Whether two plain units may be related directly; default "allowed" (3.8). */
  directRelations?: 'allowed' | 'issue';
}

const plain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string' && v.length > 0;
const texts = (v: unknown) => Array.isArray(v) && v.every(text);
const choice = (v: unknown) => v === 'allowed' || v === 'issue';

/** Whether a value is a profile as JSON: known fields only, each of its own kind. */
export function isProfileJson(v: unknown): v is ProfileJson {
  if (!plain(v)) return false;
  const checks: Record<string, (x: unknown) => boolean> = {
    kinds: (x) =>
      Array.isArray(x) &&
      x.every((k) => plain(k) && text(k.id) && text(k.field) && 'equals' in k && typeof k.joins === 'boolean'),
    classField: text,
    classUnitField: text,
    pairField: text,
    pairTypeField: text,
    pairs: (x) => Array.isArray(x) && x.every((p) => Array.isArray(p) && p.length === 2 && p.every(text)),
    supersededBy: texts,
    selfRelations: choice,
    directRelations: choice,
  };
  return Object.entries(v).every(([k, x]) => Object.hasOwn(checks, k) && checks[k](x));
}
