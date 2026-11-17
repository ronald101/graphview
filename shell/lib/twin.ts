// The invented family the shell opens as a host with interface graphs would (specification 8.10): its
// examples load with a profile as JSON and the perspective drawing, given as the viewer's base values.
import type { ProfileJson } from '../../module/index.ts';

/** Courses and people: superseded by a revision, self-definitions allowed, and every relation through an interface. */
export const TWIN_PROFILE: ProfileJson = {
  pairs: [
    ['memberOf', 'hasMember'],
    ['teaches', 'taughtBy'],
    ['replaces', 'replacedBy'],
  ],
  supersededBy: ['replacedBy'],
  selfRelations: 'allowed',
  directRelations: 'issue',
};

/** The examples of the family. */
export const TWIN_EXAMPLES: ReadonlySet<string> = new Set(['classes-and-perspectives']);

/** The viewer's base values for a graph of the family, or none. */
export const hostSettings = (example: string | null): Record<string, unknown> =>
  example !== null && TWIN_EXAMPLES.has(example)
    ? { 'extensions.profile': TWIN_PROFILE, 'drawing.relations': 'perspectives' }
    : {};
